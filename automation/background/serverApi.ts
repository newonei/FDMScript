import {
  REMOTE_AUTOMATION_CAPABILITIES,
  type RemoteAutomationConfig,
  type RemoteAutomationTaskResult,
  updateRemoteAutomationRuntime,
} from '@/utils/remoteAutomation';
import { buildUrl } from '@/automation/background/helpers';

export async function postJson<TResponse>(
  config: RemoteAutomationConfig,
  path: string,
  payload: Record<string, unknown>,
): Promise<TResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    config.requestTimeoutMs,
  );

  try {
    const response = await fetch(buildUrl(config.serverBaseUrl, path), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey
          ? {
              Authorization: `Bearer ${config.apiKey}`,
            }
          : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} ${response.statusText}: ${text || 'No response body.'}`,
      );
    }

    if (!text) {
      return {} as TResponse;
    }

    return JSON.parse(text) as TResponse;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function registerDevice(
  config: RemoteAutomationConfig,
): Promise<void> {
  await postJson<Record<string, unknown>>(
    config,
    '/api/remote-automation/register',
    {
      deviceId: config.deviceId,
      deviceName: config.deviceName,
      extensionVersion: browser.runtime.getManifest().version,
      browser: import.meta.env.BROWSER,
      manifestVersion: browser.runtime.getManifest().manifest_version,
      capabilities: REMOTE_AUTOMATION_CAPABILITIES,
    },
  );

  await updateRemoteAutomationRuntime({
    isRegistered: true,
    lastRegistrationAt: new Date().toISOString(),
    lastStatusMessage: 'Device registration is up to date.',
    lastError: null,
  });
}

export async function reportTaskResult(
  config: RemoteAutomationConfig,
  result: RemoteAutomationTaskResult,
): Promise<void> {
  await postJson<Record<string, unknown>>(
    config,
    '/api/remote-automation/report',
    {
      deviceId: config.deviceId,
      deviceName: config.deviceName,
      reportedAt: new Date().toISOString(),
      result,
    },
  );

  await updateRemoteAutomationRuntime({
    lastStatusMessage:
      result.status === 'success'
        ? `Task ${result.taskId} completed and was reported to the server.`
        : `Task ${result.taskId} failed and was reported to the server.`,
    lastError: result.status === 'failed' ? result.error ?? null : null,
  });
}
