import {
  REMOTE_AUTOMATION_CAPABILITIES,
  REMOTE_AUTOMATION_POLL_ALARM,
  type PddPublishProductPayload,
  type RemoteAutomationBackgroundRequest,
  type RemoteAutomationBackgroundResponse,
  type RemoteAutomationConfig,
  type RemoteAutomationPollResponse,
  getRemoteAutomationStore,
  saveRemoteAutomationConfig,
  updateRemoteAutomationRuntime,
} from '@/utils/remoteAutomation';
import {
  createPddPublishDemoTask,
  createSmokeDemoTask,
} from '@/automation/background/demoTasks';
import {
  isRemoteAutomationRequest,
  shouldRegisterDevice,
  toErrorMessage,
} from '@/automation/background/helpers';
import { setInputFilesOnTab } from '@/automation/background/fileUploadBridge';
import { buildBackgroundResponse } from '@/automation/background/responses';
import { postJson, registerDevice, reportTaskResult } from '@/automation/background/serverApi';
import { runAutomationTask } from '@/automation/background/taskExecutor';
import type {
  MessageSenderLike,
  RemoteAutomationTrigger,
} from '@/automation/background/types';

export function registerRemoteAutomationBackground(): void {
  const controller = new RemoteAutomationBackgroundController();

  browser.runtime.onInstalled.addListener(() => {
    void controller.bootstrapRemoteAutomation('install');
  });

  browser.runtime.onStartup.addListener(() => {
    void controller.bootstrapRemoteAutomation('startup');
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === REMOTE_AUTOMATION_POLL_ALARM) {
      void controller.pollRemoteAutomation('alarm');
    }
  });

  browser.runtime.onMessage.addListener((message: unknown, sender) => {
    if (!isRemoteAutomationRequest(message)) {
      return undefined;
    }

    return controller.handleRemoteAutomationMessage(message, sender);
  });

  void controller.bootstrapRemoteAutomation('bootstrap');
}

class RemoteAutomationBackgroundController {
  private isPolling = false;

  async handleRemoteAutomationMessage(
    message: RemoteAutomationBackgroundRequest,
    sender?: MessageSenderLike,
  ): Promise<RemoteAutomationBackgroundResponse> {
    switch (message.type) {
      case 'getStatus':
        return buildBackgroundResponse(true, 'Loaded remote automation status.');

      case 'saveConfig': {
        const store = await saveRemoteAutomationConfig(message.config);
        await this.syncPollAlarm(store.config);

        if (store.config.enabled && store.config.serverBaseUrl) {
          try {
            await registerDevice(store.config);
          } catch (error) {
            await updateRemoteAutomationRuntime({
              isRegistered: false,
              lastError: toErrorMessage(error),
              lastStatusMessage:
                'Saved the settings, but the first registration attempt failed.',
            });
          }
        } else {
          await updateRemoteAutomationRuntime({
            isRegistered: false,
            lastError: null,
            lastStatusMessage: store.config.enabled
              ? 'Saved settings. Add a server URL to start polling.'
              : 'Remote automation is disabled.',
          });
        }

        return buildBackgroundResponse(true, 'Saved remote automation settings.');
      }

      case 'pollNow':
        return this.pollRemoteAutomation('manual');

      case 'runDemoTask':
        return this.runDemoTask();

      case 'runPddPublishTask':
        return this.runPddPublishTask(message.payload);

      case 'setInputFiles': {
        if (typeof sender?.tab?.id !== 'number') {
          return buildBackgroundResponse(
            false,
            'The file upload request did not originate from a tab.',
          );
        }

        const uploadDiagnostics = await setInputFilesOnTab(
          sender.tab.id,
          message.selector,
          message.files,
          message.matchIndex ?? 0,
          message.dispatchEvents ?? false,
          message.captureNetworkMs ?? 0,
        );
        return buildBackgroundResponse(
          true,
          `Prepared ${message.files.length} file(s) for upload.`,
          undefined,
          uploadDiagnostics,
        );
      }
    }
  }

  async bootstrapRemoteAutomation(
    trigger: RemoteAutomationTrigger,
  ): Promise<void> {
    const store = await getRemoteAutomationStore();
    await this.syncPollAlarm(store.config);

    if (!store.config.enabled) {
      await updateRemoteAutomationRuntime({
        isRegistered: false,
        isPolling: false,
        lastError: null,
        lastStatusMessage: 'Remote automation is disabled.',
      });
      return;
    }

    if (!store.config.serverBaseUrl) {
      await updateRemoteAutomationRuntime({
        isRegistered: false,
        isPolling: false,
        lastStatusMessage:
          'Remote automation is enabled, but the server URL has not been configured.',
      });
      return;
    }

    try {
      await registerDevice(store.config);
    } catch (error) {
      await updateRemoteAutomationRuntime({
        isRegistered: false,
        isPolling: false,
        lastError: toErrorMessage(error),
        lastStatusMessage: `Registration failed during ${trigger}.`,
      });
    }
  }

  async pollRemoteAutomation(
    trigger: Extract<RemoteAutomationTrigger, 'alarm' | 'manual'>,
  ): Promise<RemoteAutomationBackgroundResponse> {
    if (this.isPolling) {
      return buildBackgroundResponse(
        false,
        'A remote automation poll is already running.',
      );
    }

    const store = await getRemoteAutomationStore();
    const { config } = store;

    if (!config.enabled) {
      return buildBackgroundResponse(false, 'Remote automation is disabled.');
    }

    if (!config.serverBaseUrl) {
      return buildBackgroundResponse(
        false,
        'Please configure the automation server URL first.',
      );
    }

    this.isPolling = true;
    const now = new Date().toISOString();

    await updateRemoteAutomationRuntime({
      isPolling: true,
      lastPollAt: now,
      lastError: null,
      lastStatusMessage:
        trigger === 'manual'
          ? 'Polling the remote automation server now...'
          : 'Checking for remote automation tasks...',
    });

    try {
      if (shouldRegisterDevice(store.runtime.lastRegistrationAt)) {
        await registerDevice(config);
      }

      const response = await postJson<RemoteAutomationPollResponse>(
        config,
        '/api/remote-automation/poll',
        {
          deviceId: config.deviceId,
          deviceName: config.deviceName,
          trigger,
          requestedAt: now,
          extensionVersion: browser.runtime.getManifest().version,
          browser: import.meta.env.BROWSER,
          manifestVersion: browser.runtime.getManifest().manifest_version,
          capabilities: REMOTE_AUTOMATION_CAPABILITIES,
          lastTaskId: store.runtime.lastTaskId,
        },
      );

      await updateRemoteAutomationRuntime({
        lastSuccessfulPollAt: new Date().toISOString(),
        lastStatusMessage:
          response.message ?? 'Connected to the remote automation server.',
        lastError: null,
      });

      if (typeof response.nextPollInMinutes === 'number') {
        await this.syncPollAlarm({
          ...config,
          pollIntervalMinutes: response.nextPollInMinutes,
        });
      }

      if (!response.task) {
        await updateRemoteAutomationRuntime({
          lastStatusMessage: 'No remote automation task is waiting right now.',
        });
        return buildBackgroundResponse(
          true,
          'No remote automation task was available.',
        );
      }

      const result = await runAutomationTask(config, response.task, 'remote');

      try {
        await reportTaskResult(config, result);
      } catch (error) {
        const message = `Task ${response.task.id} finished locally, but reporting failed: ${toErrorMessage(error)}`;
        await updateRemoteAutomationRuntime({
          lastError: message,
          lastStatusMessage: message,
        });
        return buildBackgroundResponse(false, message, result);
      }

      return buildBackgroundResponse(
        result.status === 'success',
        result.status === 'success'
          ? `Task ${response.task.id} completed successfully.`
          : `Task ${response.task.id} failed.`,
        result,
      );
    } catch (error) {
      const message = toErrorMessage(error);
      await updateRemoteAutomationRuntime({
        lastError: message,
        lastStatusMessage: 'The remote automation poll failed.',
      });
      return buildBackgroundResponse(false, message);
    } finally {
      this.isPolling = false;
      await updateRemoteAutomationRuntime({
        isPolling: false,
      });
    }
  }

  private async runDemoTask(): Promise<RemoteAutomationBackgroundResponse> {
    const store = await getRemoteAutomationStore();
    const task = createSmokeDemoTask();
    const result = await runAutomationTask(store.config, task, 'demo');

    return buildBackgroundResponse(
      result.status === 'success',
      result.status === 'success'
        ? 'The demo automation task finished successfully.'
        : 'The demo automation task failed.',
      result,
    );
  }

  private async runPddPublishTask(
    payload: PddPublishProductPayload,
  ): Promise<RemoteAutomationBackgroundResponse> {
    const store = await getRemoteAutomationStore();
    const task = createPddPublishDemoTask(payload);
    const result = await runAutomationTask(store.config, task, 'demo');

    return buildBackgroundResponse(
      result.status === 'success',
      result.status === 'success'
        ? 'The PDD publish demo task finished successfully.'
        : 'The PDD publish demo task failed.',
      result,
    );
  }

  private async syncPollAlarm(config: RemoteAutomationConfig): Promise<void> {
    await browser.alarms.clear(REMOTE_AUTOMATION_POLL_ALARM);

    if (!config.enabled || !config.serverBaseUrl) {
      return;
    }

    await browser.alarms.create(REMOTE_AUTOMATION_POLL_ALARM, {
      periodInMinutes: Math.max(1, config.pollIntervalMinutes),
    });
  }
}
