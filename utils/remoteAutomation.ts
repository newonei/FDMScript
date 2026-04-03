export const REMOTE_AUTOMATION_STORE_KEY = 'remoteAutomation';
export const REMOTE_AUTOMATION_POLL_ALARM = 'remote-automation:poll';

export const REMOTE_AUTOMATION_CAPABILITIES = [
  'wait',
  'waitForSelector',
  'click',
  'type',
  'select',
  'scrollIntoView',
  'press',
  'extractText',
  'extractAttribute',
] as const;

export type RemoteAutomationCapability =
  (typeof REMOTE_AUTOMATION_CAPABILITIES)[number];

export type RemoteAutomationConfig = {
  enabled: boolean;
  serverBaseUrl: string;
  apiKey: string;
  deviceId: string;
  deviceName: string;
  pollIntervalMinutes: number;
  openTabsInBackground: boolean;
  closeTabOnFinish: boolean;
  requestTimeoutMs: number;
  operationDelayMinMs: number;
  operationDelayMaxMs: number;
};

export type RemoteAutomationRuntimeState = {
  isPolling: boolean;
  isRegistered: boolean;
  lastPollAt: string | null;
  lastSuccessfulPollAt: string | null;
  lastRegistrationAt: string | null;
  lastTaskId: string | null;
  lastTaskStartedAt: string | null;
  lastTaskFinishedAt: string | null;
  lastStatusMessage: string;
  lastError: string | null;
  lastResultSummary: string | null;
};

export type RemoteAutomationStore = {
  version: 1;
  config: RemoteAutomationConfig;
  runtime: RemoteAutomationRuntimeState;
};

export type RemoteAutomationWaitStep = {
  type: 'wait';
  ms: number;
};

export type RemoteAutomationWaitForSelectorStep = {
  type: 'waitForSelector';
  selector: string;
  timeoutMs?: number;
  visible?: boolean;
};

export type RemoteAutomationClickStep = {
  type: 'click';
  selector: string;
  timeoutMs?: number;
  waitAfterMs?: number;
};

export type RemoteAutomationTypeStep = {
  type: 'type';
  selector: string;
  text: string;
  timeoutMs?: number;
  clear?: boolean;
  delayMs?: number;
};

export type RemoteAutomationSelectStep = {
  type: 'select';
  selector: string;
  value: string;
  timeoutMs?: number;
};

export type RemoteAutomationScrollIntoViewStep = {
  type: 'scrollIntoView';
  selector: string;
  timeoutMs?: number;
};

export type RemoteAutomationPressStep = {
  type: 'press';
  selector: string;
  key: string;
  timeoutMs?: number;
};

export type RemoteAutomationExtractTextStep = {
  type: 'extractText';
  selector: string;
  key: string;
  timeoutMs?: number;
  trim?: boolean;
};

export type RemoteAutomationExtractAttributeStep = {
  type: 'extractAttribute';
  selector: string;
  attribute: string;
  key: string;
  timeoutMs?: number;
};

export type RemoteAutomationStep =
  | RemoteAutomationWaitStep
  | RemoteAutomationWaitForSelectorStep
  | RemoteAutomationClickStep
  | RemoteAutomationTypeStep
  | RemoteAutomationSelectStep
  | RemoteAutomationScrollIntoViewStep
  | RemoteAutomationPressStep
  | RemoteAutomationExtractTextStep
  | RemoteAutomationExtractAttributeStep;

export type PddCategorySelectionMode = 'first' | 'exact';

export type PddPublishSpec = {
  name: string;
  values: string[];
};

export type PddPublishSkuRow = {
  specs: string[];
  stock: number | string;
  groupPrice: number | string;
  singlePrice: number | string;
  previewImage?: string;
  skuCode?: string;
  enabled?: boolean;
};

export type PddPublishProductPayload = {
  categoryKeyword: string;
  categorySelectionMode?: PddCategorySelectionMode;
  categorySelectionText?: string;
  title: string;
  carouselImages: string[];
  introVideoPath?: string;
  detailImages?: string[];
  specs: PddPublishSpec[];
  skuRows: PddPublishSkuRow[];
};

export type RemoteAutomationUploadDiagnosticEntry = {
  url: string;
  method: string;
  resourceType?: string;
  status?: number;
  statusText?: string;
  errorText?: string;
  bodySnippet?: string;
};

export type RemoteAutomationUploadDiagnostics = {
  entries: RemoteAutomationUploadDiagnosticEntry[];
  failures: string[];
};

export type RemoteAutomationTask = {
  id: string;
  url: string;
  title?: string;
  active?: boolean;
  closeTabOnFinish?: boolean;
  waitForPageMs?: number;
  mode?: 'generic' | 'pddPublishProduct';
  steps?: RemoteAutomationStep[];
  pddPublish?: PddPublishProductPayload;
  metadata?: Record<string, unknown>;
};

export type RemoteAutomationExecutionMessage = {
  scope: 'remoteAutomation';
  type: 'runTask';
  task: RemoteAutomationTask;
};

export type RemoteAutomationExecutionResult = {
  ok: boolean;
  pageUrl: string;
  pageTitle: string;
  extracted: Record<string, string>;
  logs: string[];
  completedSteps: number;
  error?: string;
};

export type RemoteAutomationTaskResult = {
  taskId: string;
  source: 'remote' | 'demo';
  status: 'success' | 'failed';
  startedAt: string;
  finishedAt: string;
  pageUrl: string;
  pageTitle: string;
  extracted: Record<string, string>;
  logs: string[];
  error?: string;
  metadata?: Record<string, unknown>;
};

export type RemoteAutomationPollResponse = {
  task?: RemoteAutomationTask | null;
  nextPollInMinutes?: number;
  message?: string;
};

export type RemoteAutomationBackgroundRequest =
  | {
      scope: 'remoteAutomation';
      type: 'getStatus';
    }
  | {
      scope: 'remoteAutomation';
      type: 'saveConfig';
      config: Partial<RemoteAutomationConfig>;
    }
  | {
      scope: 'remoteAutomation';
      type: 'pollNow';
    }
  | {
      scope: 'remoteAutomation';
      type: 'runDemoTask';
    }
  | {
      scope: 'remoteAutomation';
      type: 'runPddPublishTask';
      payload: PddPublishProductPayload;
    }
  | {
      scope: 'remoteAutomation';
      type: 'setInputFiles';
      selector: string;
      files: string[];
      matchIndex?: number;
      dispatchEvents?: boolean;
      captureNetworkMs?: number;
    };

export type RemoteAutomationBackgroundResponse = {
  ok: boolean;
  message: string;
  store: RemoteAutomationStore;
  result?: RemoteAutomationTaskResult;
  uploadDiagnostics?: RemoteAutomationUploadDiagnostics;
};

export function sanitizeServerBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

export function clampPollIntervalMinutes(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(60, Math.max(1, Math.round(value)));
}

export function clampRequestTimeoutMs(value: number): number {
  if (!Number.isFinite(value)) {
    return 15_000;
  }

  return Math.min(120_000, Math.max(3_000, Math.round(value)));
}

export function clampOperationDelayMs(value: number): number {
  if (!Number.isFinite(value)) {
    return 300;
  }

  return Math.min(5_000, Math.max(0, Math.round(value)));
}

export function summarizeTaskResult(result: RemoteAutomationTaskResult): string {
  if (result.status === 'failed') {
    return result.error ?? 'Task failed before returning a reason.';
  }

  const firstEntry = Object.entries(result.extracted)[0];
  if (firstEntry) {
    return `${firstEntry[0]}: ${firstEntry[1]}`;
  }

  return `Completed ${result.logs.length} automation log entries.`;
}

export function validateRemoteAutomationTask(task: RemoteAutomationTask): void {
  if (task.mode === 'pddPublishProduct') {
    validatePddPublishPayload(task.pddPublish);
    return;
  }

  if (!task.steps || task.steps.length === 0) {
    throw new Error('Generic automation tasks require at least one step.');
  }
}

export async function getRemoteAutomationStore(): Promise<RemoteAutomationStore> {
  const stored = await browser.storage.local.get(REMOTE_AUTOMATION_STORE_KEY);
  return normalizeRemoteAutomationStore(
    stored[REMOTE_AUTOMATION_STORE_KEY] as Partial<RemoteAutomationStore> | undefined,
  );
}

export async function saveRemoteAutomationStore(
  store: Partial<RemoteAutomationStore>,
): Promise<RemoteAutomationStore> {
  const normalized = normalizeRemoteAutomationStore(store);
  await browser.storage.local.set({
    [REMOTE_AUTOMATION_STORE_KEY]: normalized,
  });
  return normalized;
}

export async function saveRemoteAutomationConfig(
  patch: Partial<RemoteAutomationConfig>,
): Promise<RemoteAutomationStore> {
  const current = await getRemoteAutomationStore();
  return saveRemoteAutomationStore({
    ...current,
    config: {
      ...current.config,
      ...patch,
    },
  });
}

export async function updateRemoteAutomationRuntime(
  patch: Partial<RemoteAutomationRuntimeState>,
): Promise<RemoteAutomationStore> {
  const current = await getRemoteAutomationStore();
  return saveRemoteAutomationStore({
    ...current,
    runtime: {
      ...current.runtime,
      ...patch,
    },
  });
}

function normalizeRemoteAutomationStore(
  value?: Partial<RemoteAutomationStore>,
): RemoteAutomationStore {
  const defaults = createDefaultRemoteAutomationStore();

  const config: RemoteAutomationConfig = {
    ...defaults.config,
    ...(value?.config ?? {}),
  };

  config.serverBaseUrl = sanitizeServerBaseUrl(config.serverBaseUrl);
  config.deviceId = config.deviceId.trim() || defaults.config.deviceId;
  config.deviceName = config.deviceName.trim() || defaults.config.deviceName;
  config.pollIntervalMinutes = clampPollIntervalMinutes(
    config.pollIntervalMinutes,
  );
  config.requestTimeoutMs = clampRequestTimeoutMs(config.requestTimeoutMs);
  config.operationDelayMinMs = clampOperationDelayMs(config.operationDelayMinMs);
  config.operationDelayMaxMs = clampOperationDelayMs(config.operationDelayMaxMs);
  if (config.operationDelayMaxMs < config.operationDelayMinMs) {
    config.operationDelayMaxMs = config.operationDelayMinMs;
  }

  const runtime: RemoteAutomationRuntimeState = {
    ...defaults.runtime,
    ...(value?.runtime ?? {}),
  };

  return {
    version: 1,
    config,
    runtime,
  };
}

function createDefaultRemoteAutomationStore(): RemoteAutomationStore {
  return {
    version: 1,
    config: {
      enabled: false,
      serverBaseUrl: '',
      apiKey: '',
      deviceId: createDeviceId(),
      deviceName: createDefaultDeviceName(),
      pollIntervalMinutes: 1,
      openTabsInBackground: true,
      closeTabOnFinish: true,
      requestTimeoutMs: 15_000,
      operationDelayMinMs: 300,
      operationDelayMaxMs: 500,
    },
    runtime: {
      isPolling: false,
      isRegistered: false,
      lastPollAt: null,
      lastSuccessfulPollAt: null,
      lastRegistrationAt: null,
      lastTaskId: null,
      lastTaskStartedAt: null,
      lastTaskFinishedAt: null,
      lastStatusMessage: 'Remote automation is ready to be configured.',
      lastError: null,
      lastResultSummary: null,
    },
  };
}

function createDeviceId(): string {
  return `fdm-${crypto.randomUUID()}`;
}

function createDefaultDeviceName(): string {
  const platform = globalThis.navigator?.platform?.trim() || 'Desktop';
  return `FDM ${platform}`;
}

function validatePddPublishPayload(
  payload: PddPublishProductPayload | undefined,
): asserts payload is PddPublishProductPayload {
  if (!payload) {
    throw new Error('PDD publish task is missing the pddPublish payload.');
  }

  if (!payload.categoryKeyword.trim()) {
    throw new Error('PDD publish task requires a category keyword.');
  }

  if (!payload.title.trim()) {
    throw new Error('PDD publish task requires a product title.');
  }

  if (!payload.carouselImages.length) {
    throw new Error('PDD publish task requires at least one carousel image.');
  }

  if (
    typeof payload.introVideoPath === 'string' &&
    !payload.introVideoPath.trim()
  ) {
    throw new Error('PDD introVideoPath cannot be an empty string.');
  }

  if (!payload.specs.length || payload.specs.length > 2) {
    throw new Error('PDD publish task requires one or two spec definitions.');
  }

  payload.specs.forEach((spec, index) => {
    if (!spec.name.trim()) {
      throw new Error(`Spec ${index + 1} is missing its type name.`);
    }

    if (!spec.values.length) {
      throw new Error(`Spec ${spec.name} needs at least one spec value.`);
    }
  });

  if (!payload.skuRows.length) {
    throw new Error('PDD publish task requires at least one SKU row.');
  }

  payload.skuRows.forEach((row, index) => {
    if (row.specs.length !== payload.specs.length) {
      throw new Error(
        `SKU row ${index + 1} must provide ${payload.specs.length} spec values.`,
      );
    }
  });
}
