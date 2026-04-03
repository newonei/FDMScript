import type { DebuggeeTarget } from '@/automation/background/types';
import type {
  RemoteAutomationUploadDiagnosticEntry,
  RemoteAutomationUploadDiagnostics,
} from '@/utils/remoteAutomation';

declare const chrome: any;

type CapturedRequest = {
  requestId: string;
  url: string;
  method: string;
  resourceType?: string;
  status?: number;
  statusText?: string;
  errorText?: string;
  finished?: boolean;
};

export async function setInputFilesOnTab(
  tabId: number,
  selector: string,
  files: string[],
  matchIndex = 0,
  dispatchEvents = false,
  captureNetworkMs = 0,
): Promise<RemoteAutomationUploadDiagnostics | undefined> {
  if (!selector.trim()) {
    throw new Error('A file upload selector is required.');
  }

  if (!files.length) {
    throw new Error('At least one local file path is required.');
  }

  const target: DebuggeeTarget = { tabId };
  const shouldCapture = captureNetworkMs > 0;

  await attachDebugger(target);

  try {
    await sendDebuggerCommand(target, 'DOM.enable');

    const requestStore = shouldCapture ? new Map<string, CapturedRequest>() : null;
    const stopCapture = shouldCapture && requestStore
      ? await startNetworkCapture(target, requestStore)
      : null;

    try {
      const documentNode = (await sendDebuggerCommand(target, 'DOM.getDocument', {
        depth: -1,
        pierce: true,
      })) as {
        root?: {
          nodeId: number;
        };
      };

      const rootNodeId = documentNode.root?.nodeId;
      if (!rootNodeId) {
        throw new Error('Could not inspect the tab DOM for file upload.');
      }

      const queryResults = (await sendDebuggerCommand(
        target,
        'DOM.querySelectorAll',
        {
          nodeId: rootNodeId,
          selector,
        },
      )) as {
        nodeIds?: number[];
      };

      const matchedNodeIds = queryResults.nodeIds ?? [];
      const targetNodeId = matchedNodeIds[matchIndex];

      if (!targetNodeId) {
        throw new Error(
          `Could not find file input match ${matchIndex} for selector: ${selector}`,
        );
      }

      const usedFileChooserFlow = dispatchEvents
        ? await trySetFilesViaInterceptedChooser(
            target,
            selector,
            matchIndex,
            files,
          )
        : false;

      if (!usedFileChooserFlow) {
        await sendDebuggerCommand(target, 'DOM.setFileInputFiles', {
          nodeId: targetNodeId,
          files,
        });
      }

      if (dispatchEvents) {
        await dispatchFileInputEvents(target, selector, matchIndex);
      }

      if (captureNetworkMs > 0) {
        await delay(captureNetworkMs);
      }
    } finally {
      if (stopCapture) {
        await stopCapture();
      }
    }

    if (!requestStore) {
      return undefined;
    }

    return await buildUploadDiagnostics(target, requestStore);
  } finally {
    await detachDebugger(target);
  }
}

async function dispatchFileInputEvents(
  target: DebuggeeTarget,
  selector: string,
  matchIndex: number,
): Promise<void> {
  const expression = `
    (() => {
      const nodes = Array.from(document.querySelectorAll(${JSON.stringify(selector)}));
      const input = nodes[${matchIndex}];
      if (!(input instanceof HTMLInputElement)) {
        return { ok: false, reason: 'input-not-found' };
      }

      const label = input.closest('label');
      const wrapper = label instanceof HTMLElement
        ? label
        : input.parentElement instanceof HTMLElement
          ? input.parentElement
          : null;

      if (wrapper instanceof HTMLElement) {
        wrapper.scrollIntoView({
          block: 'center',
          inline: 'nearest',
          behavior: 'auto',
        });
      }

      input.focus({ preventScroll: true });
      input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      input.blur();

      return {
        ok: true,
        fileCount: input.files ? input.files.length : 0,
        hasLabel: Boolean(label),
      };
    })()
  `;

  const result = (await sendDebuggerCommand(target, 'Runtime.evaluate', {
    expression,
    returnByValue: true,
    userGesture: true,
    awaitPromise: false,
  })) as {
    result?: {
      value?: {
        ok?: boolean;
        reason?: string;
      };
    };
    exceptionDetails?: unknown;
  };

  const payload = result.result?.value;
  if (!payload?.ok) {
    throw new Error(
      `Could not dispatch file upload events: ${payload?.reason ?? 'unknown-error'}`,
    );
  }
}

async function trySetFilesViaInterceptedChooser(
  target: DebuggeeTarget,
  selector: string,
  matchIndex: number,
  files: string[],
): Promise<boolean> {
  const eventHandler = createFileChooserEventHandler(target);

  try {
    await sendDebuggerCommand(target, 'Page.enable');
    await sendDebuggerCommand(target, 'Page.setInterceptFileChooserDialog', {
      enabled: true,
    });
    chrome.debugger.onEvent.addListener(eventHandler.handleEvent);

    await triggerFileChooser(target, selector, matchIndex);
    const backendNodeId = await eventHandler.waitForChooser();
    if (!backendNodeId) {
      return false;
    }

    await sendDebuggerCommand(target, 'DOM.setFileInputFiles', {
      backendNodeId,
      files,
    });
    return true;
  } catch {
    return false;
  } finally {
    chrome.debugger.onEvent.removeListener(eventHandler.handleEvent);
    try {
      await sendDebuggerCommand(target, 'Page.setInterceptFileChooserDialog', {
        enabled: false,
      });
    } catch {
      // Ignore cleanup failures while switching back to the regular flow.
    }
    try {
      await sendDebuggerCommand(target, 'Page.disable');
    } catch {
      // Ignore cleanup failures while closing the temporary Page domain session.
    }
  }
}

function createFileChooserEventHandler(target: DebuggeeTarget): {
  handleEvent: (_source: DebuggeeTarget, method: string, params?: any) => void;
  waitForChooser: () => Promise<number | null>;
} {
  let resolveChooser: ((backendNodeId: number | null) => void) | null = null;
  const chooserPromise = new Promise<number | null>((resolve) => {
    resolveChooser = resolve;
    setTimeout(() => resolve(null), 1_500);
  });

  return {
    handleEvent: (_source: DebuggeeTarget, method: string, params?: any) => {
      if (_source.tabId !== target.tabId) {
        return;
      }

      if (method !== 'Page.fileChooserOpened') {
        return;
      }

      const backendNodeId = params?.backendNodeId as number | undefined;
      if (typeof backendNodeId === 'number') {
        resolveChooser?.(backendNodeId);
        resolveChooser = null;
      }
    },
    waitForChooser: async () => chooserPromise,
  };
}

async function triggerFileChooser(
  target: DebuggeeTarget,
  selector: string,
  matchIndex: number,
): Promise<void> {
  const expression = `
    (() => {
      const nodes = Array.from(document.querySelectorAll(${JSON.stringify(selector)}));
      const input = nodes[${matchIndex}];
      if (!(input instanceof HTMLInputElement)) {
        return { ok: false, reason: 'input-not-found' };
      }

      const trigger = input.closest('label') ?? input;
      if (trigger instanceof HTMLElement) {
        trigger.scrollIntoView({
          block: 'center',
          inline: 'nearest',
          behavior: 'auto',
        });
      }

      input.click();
      return { ok: true };
    })()
  `;

  const result = (await sendDebuggerCommand(target, 'Runtime.evaluate', {
    expression,
    returnByValue: true,
    userGesture: true,
    awaitPromise: false,
  })) as {
    result?: {
      value?: {
        ok?: boolean;
        reason?: string;
      };
    };
  };

  const payload = result.result?.value;
  if (!payload?.ok) {
    throw new Error(
      `Could not trigger the file chooser: ${payload?.reason ?? 'unknown-error'}`,
    );
  }
}

async function startNetworkCapture(
  target: DebuggeeTarget,
  requestStore: Map<string, CapturedRequest>,
): Promise<() => Promise<void>> {
  const eventHandler = (_source: DebuggeeTarget, method: string, params?: any) => {
    if (_source.tabId !== target.tabId) {
      return;
    }

    if (method === 'Network.requestWillBeSent') {
      const requestId = params?.requestId as string | undefined;
      if (!requestId) {
        return;
      }

      requestStore.set(requestId, {
        requestId,
        url: params?.request?.url ?? '',
        method: params?.request?.method ?? 'GET',
        resourceType: params?.type,
      });
      return;
    }

    if (method === 'Network.responseReceived') {
      const requestId = params?.requestId as string | undefined;
      if (!requestId) {
        return;
      }

      const current = requestStore.get(requestId);
      if (!current) {
        return;
      }

      current.status = params?.response?.status;
      current.statusText = params?.response?.statusText;
      current.resourceType = current.resourceType ?? params?.type;
      return;
    }

    if (method === 'Network.loadingFinished') {
      const requestId = params?.requestId as string | undefined;
      if (!requestId) {
        return;
      }

      const current = requestStore.get(requestId);
      if (!current) {
        return;
      }

      current.finished = true;
      return;
    }

    if (method === 'Network.loadingFailed') {
      const requestId = params?.requestId as string | undefined;
      if (!requestId) {
        return;
      }

      const current = requestStore.get(requestId);
      if (!current) {
        return;
      }

      current.errorText = params?.errorText ?? 'Unknown network failure';
    }
  };

  chrome.debugger.onEvent.addListener(eventHandler);
  await sendDebuggerCommand(target, 'Network.enable');

  return async () => {
    chrome.debugger.onEvent.removeListener(eventHandler);
    try {
      await sendDebuggerCommand(target, 'Network.disable');
    } catch {
      // Ignore cleanup failures while closing the debugger session.
    }
  };
}

async function buildUploadDiagnostics(
  target: DebuggeeTarget,
  requestStore: Map<string, CapturedRequest>,
): Promise<RemoteAutomationUploadDiagnostics> {
  const relevantRequests = Array.from(requestStore.values())
    .filter((entry) => isRelevantUploadRequest(entry))
    .slice(-15);

  const entries: RemoteAutomationUploadDiagnosticEntry[] = [];

  for (const request of relevantRequests) {
    entries.push({
      url: request.url,
      method: request.method,
      resourceType: request.resourceType,
      status: request.status,
      statusText: request.statusText,
      errorText: request.errorText,
      bodySnippet: await tryGetResponseBody(target, request),
    });
  }

  const failures = entries
    .map((entry) => summarizeUploadFailure(entry))
    .filter((value): value is string => Boolean(value));

  return {
    entries,
    failures,
  };
}

function isRelevantUploadRequest(entry: CapturedRequest): boolean {
  const url = entry.url.toLowerCase();
  const type = (entry.resourceType ?? '').toLowerCase();

  return (
    type === 'fetch' ||
    type === 'xhr' ||
    url.includes('upload') ||
    url.includes('image') ||
    url.includes('material') ||
    url.includes('tos') ||
    Boolean(entry.errorText)
  );
}

function summarizeUploadFailure(
  entry: RemoteAutomationUploadDiagnosticEntry,
): string | null {
  const body = (entry.bodySnippet ?? '').toLowerCase();

  if (entry.errorText) {
    return `${entry.method} ${entry.url} failed: ${entry.errorText}`;
  }

  if (typeof entry.status === 'number' && entry.status >= 400) {
    return `${entry.method} ${entry.url} returned ${entry.status} ${entry.statusText ?? ''}`.trim();
  }

  if (
    body.includes('upload fail') ||
    body.includes('上传失败') ||
    body.includes('"success":false') ||
    body.includes('"code":') ||
    body.includes('"errmsg"') ||
    body.includes('"error"')
  ) {
    return `${entry.method} ${entry.url} response: ${entry.bodySnippet ?? ''}`;
  }

  return null;
}

async function tryGetResponseBody(
  target: DebuggeeTarget,
  request: CapturedRequest,
): Promise<string | undefined> {
  if (!request.finished) {
    return undefined;
  }

  try {
    const result = (await sendDebuggerCommand(target, 'Network.getResponseBody', {
      requestId: request.requestId,
    })) as {
      body?: string;
      base64Encoded?: boolean;
    };

    if (!result.body) {
      return undefined;
    }

    if (result.base64Encoded) {
      return '[base64 body omitted]';
    }

    return result.body.slice(0, 500);
  } catch {
    return undefined;
  }
}

async function attachDebugger(target: DebuggeeTarget): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    chrome.debugger.attach(target, '1.3', () => {
      const error = chrome.runtime.lastError;
      if (error) {
        if (
          error.message?.includes('Another debugger is already attached') ||
          error.message?.includes('Cannot access a chrome:// URL')
        ) {
          reject(new Error(error.message));
          return;
        }

        if (error.message?.includes('already attached')) {
          resolve();
          return;
        }

        reject(new Error(error.message));
        return;
      }

      resolve();
    });
  });
}

async function detachDebugger(target: DebuggeeTarget): Promise<void> {
  await new Promise<void>((resolve) => {
    chrome.debugger.detach(target, () => {
      resolve();
    });
  });
}

async function sendDebuggerCommand<TParams extends object>(
  target: DebuggeeTarget,
  method: string,
  params?: TParams,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand(
      target,
      method,
      params ?? {},
      (result: unknown) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }

        resolve(result);
      },
    );
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
