import {
  summarizeTaskResult,
  type RemoteAutomationConfig,
  type RemoteAutomationExecutionMessage,
  type RemoteAutomationExecutionResult,
  type RemoteAutomationTask,
  type RemoteAutomationTaskResult,
  updateRemoteAutomationRuntime,
  validateRemoteAutomationTask,
} from '@/utils/remoteAutomation';
import { delay, toErrorMessage } from '@/automation/background/helpers';

export async function runAutomationTask(
  config: RemoteAutomationConfig,
  task: RemoteAutomationTask,
  source: 'remote' | 'demo',
): Promise<RemoteAutomationTaskResult> {
  validateRemoteAutomationTask(task);
  const startedAt = new Date().toISOString();
  const active = task.active ?? !config.openTabsInBackground;
  const closeTabOnFinish = task.closeTabOnFinish ?? config.closeTabOnFinish;

  let tabId: number | undefined;

  await updateRemoteAutomationRuntime({
    lastTaskId: task.id,
    lastTaskStartedAt: startedAt,
    lastStatusMessage: `Running task ${task.id}${task.title ? ` (${task.title})` : ''}.`,
    lastError: null,
  });

  try {
    const tab = await browser.tabs.create({
      url: task.url,
      active,
    });

    if (typeof tab.id !== 'number') {
      throw new Error('The automation tab could not be created.');
    }

    tabId = tab.id;
    await waitForTabToComplete(tab.id, task.waitForPageMs ?? 30_000);
    await delay(350);

    const executionResult = await sendTaskToContentScript(tab.id, task);
    const finishedAt = new Date().toISOString();
    const result: RemoteAutomationTaskResult = {
      taskId: task.id,
      source,
      status: executionResult.ok ? 'success' : 'failed',
      startedAt,
      finishedAt,
      pageUrl: executionResult.pageUrl,
      pageTitle: executionResult.pageTitle,
      extracted: executionResult.extracted,
      logs: executionResult.logs,
      error: executionResult.error,
      metadata: task.metadata,
    };

    await updateRemoteAutomationRuntime({
      lastTaskFinishedAt: finishedAt,
      lastResultSummary: summarizeTaskResult(result),
      lastStatusMessage: executionResult.ok
        ? `Task ${task.id} finished successfully.`
        : `Task ${task.id} failed during page execution.`,
      lastError: executionResult.error ?? null,
    });

    return result;
  } catch (error) {
    const finishedAt = new Date().toISOString();
    const pageDetails =
      typeof tabId === 'number'
        ? await browser.tabs.get(tabId).catch(() => undefined)
        : undefined;
    const result: RemoteAutomationTaskResult = {
      taskId: task.id,
      source,
      status: 'failed',
      startedAt,
      finishedAt,
      pageUrl: pageDetails?.url ?? task.url,
      pageTitle: pageDetails?.title ?? task.title ?? 'Unknown page',
      extracted: {},
      logs: [],
      error: toErrorMessage(error),
      metadata: task.metadata,
    };

    await updateRemoteAutomationRuntime({
      lastTaskFinishedAt: finishedAt,
      lastResultSummary: summarizeTaskResult(result),
      lastStatusMessage: `Task ${task.id} failed before completion.`,
      lastError: result.error ?? 'Task failed.',
    });

    return result;
  } finally {
    if (closeTabOnFinish && typeof tabId === 'number') {
      await browser.tabs.remove(tabId).catch(() => undefined);
    }
  }
}

async function waitForTabToComplete(
  tabId: number,
  timeoutMs: number,
): Promise<void> {
  const existingTab = await browser.tabs.get(tabId);
  if (existingTab.status === 'complete') {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out while waiting for tab ${tabId} to load.`));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeoutId);
      browser.tabs.onUpdated.removeListener(onUpdated);
      browser.tabs.onRemoved.removeListener(onRemoved);
    };

    const onUpdated = (
      updatedTabId: number,
      changeInfo: { status?: string },
    ) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        cleanup();
        resolve();
      }
    };

    const onRemoved = (removedTabId: number) => {
      if (removedTabId === tabId) {
        cleanup();
        reject(new Error(`Automation tab ${tabId} was closed before loading.`));
      }
    };

    browser.tabs.onUpdated.addListener(onUpdated);
    browser.tabs.onRemoved.addListener(onRemoved);
  });
}

async function sendTaskToContentScript(
  tabId: number,
  task: RemoteAutomationTask,
): Promise<RemoteAutomationExecutionResult> {
  const message: RemoteAutomationExecutionMessage = {
    scope: 'remoteAutomation',
    type: 'runTask',
    task,
  };

  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      return (await browser.tabs.sendMessage(
        tabId,
        message,
      )) as RemoteAutomationExecutionResult;
    } catch (error) {
      if (attempt === 12) {
        throw new Error(
          `The content script did not respond for tab ${tabId}: ${toErrorMessage(error)}`,
        );
      }

      await delay(250);
    }
  }

  throw new Error('The content script retry loop exited unexpectedly.');
}
