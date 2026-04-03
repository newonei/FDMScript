import './style.css';

import {
  clampOperationDelayMs,
  clampPollIntervalMinutes,
  type RemoteAutomationBackgroundRequest,
  type RemoteAutomationBackgroundResponse,
  type RemoteAutomationStore,
} from '@/utils/remoteAutomation';

type NoticeTone = 'neutral' | 'success' | 'danger';

type ViewState = {
  isLoading: boolean;
  busyAction: 'save' | 'poll' | 'demo' | null;
  noticeText: string;
  noticeTone: NoticeTone;
  store: RemoteAutomationStore | null;
};

const appElement = document.querySelector<HTMLDivElement>('#app');

if (!appElement) {
  throw new Error('Options root #app was not found.');
}

const app = appElement;

const state: ViewState = {
  isLoading: true,
  busyAction: null,
  noticeText: '正在加载远程自动化状态...',
  noticeTone: 'neutral',
  store: null,
};

void refreshStatus();

function render(): void {
  const store = state.store;
  const config = store?.config;
  const runtime = store?.runtime;

  app.innerHTML = `
    <main class="options-shell">
      <section class="hero">
        <div>
          <p class="hero__eyebrow">Remote Automation</p>
          <h1>远程自动化控制台</h1>
          <p class="hero__subtitle">
            为插件配置任务中心地址，让浏览器按服务端下发的 JSON 步骤自动打开网页并执行操作。
          </p>
        </div>
        <div class="hero__status">
          <span class="status-pill status-pill--${getStatusTone()}">${getStatusLabel()}</span>
          <span class="hero__device">${escapeHtml(config?.deviceId ?? '-')}</span>
        </div>
      </section>

      <section class="notice notice--${state.noticeTone}">
        ${escapeHtml(state.noticeText)}
      </section>

      <section class="panel">
        <div class="panel__header">
          <div>
            <h2>基础配置</h2>
            <p>这些配置会保存在插件本地，并由后台 service worker 使用。</p>
          </div>
        </div>

        <form class="settings-form" data-role="settings-form">
          <label class="field field--checkbox">
            <input
              type="checkbox"
              name="enabled"
              ${config?.enabled ? 'checked' : ''}
            />
            <span>启用远程自动化轮询</span>
          </label>

          <label class="field">
            <span>服务端地址</span>
            <input
              type="url"
              name="serverBaseUrl"
              placeholder="https://your-server.example.com"
              value="${escapeHtml(config?.serverBaseUrl ?? '')}"
            />
          </label>

          <label class="field">
            <span>API Key</span>
            <input
              type="password"
              name="apiKey"
              placeholder="可选，留空则不发送 Authorization"
              value="${escapeHtml(config?.apiKey ?? '')}"
            />
          </label>

          <div class="field-row">
            <label class="field">
              <span>设备名称</span>
              <input
                type="text"
                name="deviceName"
                value="${escapeHtml(config?.deviceName ?? '')}"
              />
            </label>

            <label class="field">
              <span>轮询间隔（分钟）</span>
              <input
                type="number"
                min="1"
                max="60"
                name="pollIntervalMinutes"
                value="${config?.pollIntervalMinutes ?? 1}"
              />
            </label>
          </div>

          <div class="field-row">
            <label class="field">
              <span>请求超时（毫秒）</span>
              <input
                type="number"
                min="3000"
                max="120000"
                step="1000"
                name="requestTimeoutMs"
                value="${config?.requestTimeoutMs ?? 15000}"
              />
            </label>

            <div class="field field--stacked">
              <div class="field-row field-row--compact">
                <label class="field">
                  <span>最小操作等待（秒）</span>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    name="operationDelayMinSeconds"
                    value="${formatOperationDelaySeconds(config?.operationDelayMinMs ?? 300)}"
                  />
                </label>

                <label class="field">
                  <span>最大操作等待（秒）</span>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    name="operationDelayMaxSeconds"
                    value="${formatOperationDelaySeconds(config?.operationDelayMaxMs ?? 500)}"
                  />
                </label>
              </div>

              <label class="field field--checkbox">
                <input
                  type="checkbox"
                  name="openTabsInBackground"
                  ${config?.openTabsInBackground ? 'checked' : ''}
                />
                <span>后台打开网页标签</span>
              </label>

              <label class="field field--checkbox">
                <input
                  type="checkbox"
                  name="closeTabOnFinish"
                  ${config?.closeTabOnFinish ? 'checked' : ''}
                />
                <span>任务完成后关闭标签页</span>
              </label>
            </div>
          </div>

          <div class="action-row">
            <button
              class="button button--primary"
              type="submit"
              ${state.busyAction === 'save' ? 'disabled' : ''}
            >
              ${state.busyAction === 'save' ? '保存中...' : '保存配置'}
            </button>
            <button
              class="button"
              type="button"
              data-action="poll-now"
              ${state.busyAction === 'poll' ? 'disabled' : ''}
            >
              ${state.busyAction === 'poll' ? '正在轮询...' : '立即拉取任务'}
            </button>
            <button
              class="button"
              type="button"
              data-action="run-demo"
              ${state.busyAction === 'demo' ? 'disabled' : ''}
            >
              ${state.busyAction === 'demo' ? '执行中...' : '运行示例任务'}
            </button>
          </div>
        </form>
      </section>

      <section class="metrics-grid">
        <article class="metric-card">
          <span class="metric-card__label">最近状态</span>
          <strong>${escapeHtml(runtime?.lastStatusMessage ?? '暂无')}</strong>
        </article>
        <article class="metric-card">
          <span class="metric-card__label">最近轮询</span>
          <strong>${escapeHtml(formatDateTime(runtime?.lastPollAt))}</strong>
        </article>
        <article class="metric-card">
          <span class="metric-card__label">最近任务</span>
          <strong>${escapeHtml(runtime?.lastTaskId ?? '暂无')}</strong>
        </article>
        <article class="metric-card">
          <span class="metric-card__label">最近结果</span>
          <strong>${escapeHtml(runtime?.lastResultSummary ?? '暂无')}</strong>
        </article>
      </section>

      <section class="panel panel--split">
        <article class="panel__block">
          <h2>服务端接口约定</h2>
          <ul class="endpoint-list">
            <li><code>POST /api/remote-automation/register</code> 注册设备与能力</li>
            <li><code>POST /api/remote-automation/poll</code> 拉取待执行任务</li>
            <li><code>POST /api/remote-automation/report</code> 回传任务结果</li>
          </ul>
          <p class="panel__tip">
            当前插件端按这三个接口工作，任务体支持打开页面、点击、输入、选择、滚动、按键和提取页面信息。
          </p>
        </article>

        <article class="panel__block">
          <h2>运行提示</h2>
          <ul class="tips-list">
            <li>浏览器必须保持运行，后台 service worker 才能按闹钟轮询任务。</li>
            <li>当前版本默认允许访问全部 HTTP/HTTPS 页面，便于执行跨站自动化。</li>
            <li>建议先用“运行示例任务”验证本机插件链路，再接服务端队列。</li>
          </ul>
        </article>
      </section>
    </main>
  `;

  bindEvents();
}

function bindEvents(): void {
  const form = app.querySelector<HTMLFormElement>('[data-role="settings-form"]');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    void handleSave(form);
  });

  app
    .querySelector<HTMLButtonElement>('[data-action="poll-now"]')
    ?.addEventListener('click', () => {
      void handleAction('poll');
    });

  app
    .querySelector<HTMLButtonElement>('[data-action="run-demo"]')
    ?.addEventListener('click', () => {
      void handleAction('demo');
    });
}

async function refreshStatus(): Promise<void> {
  state.isLoading = true;
  render();

  try {
    const response = await sendRequest({
      scope: 'remoteAutomation',
      type: 'getStatus',
    });

    state.store = response.store;
    state.noticeText = response.message;
    state.noticeTone = response.ok ? 'neutral' : 'danger';
  } catch (error) {
    state.noticeText = toErrorMessage(error);
    state.noticeTone = 'danger';
  } finally {
    state.isLoading = false;
    render();
  }
}

async function handleSave(form: HTMLFormElement): Promise<void> {
  state.busyAction = 'save';
  render();

  const formData = new FormData(form);

  try {
    const response = await sendRequest({
      scope: 'remoteAutomation',
      type: 'saveConfig',
      config: {
        enabled: formData.get('enabled') === 'on',
        serverBaseUrl: String(formData.get('serverBaseUrl') ?? ''),
        apiKey: String(formData.get('apiKey') ?? ''),
        deviceName: String(formData.get('deviceName') ?? ''),
        pollIntervalMinutes: clampPollIntervalMinutes(
          Number(formData.get('pollIntervalMinutes') ?? 1),
        ),
        openTabsInBackground: formData.get('openTabsInBackground') === 'on',
        closeTabOnFinish: formData.get('closeTabOnFinish') === 'on',
        requestTimeoutMs: Number(formData.get('requestTimeoutMs') ?? 15000),
        operationDelayMinMs: clampOperationDelayMs(
          parseOperationDelaySeconds(formData.get('operationDelayMinSeconds'), 300),
        ),
        operationDelayMaxMs: clampOperationDelayMs(
          parseOperationDelaySeconds(formData.get('operationDelayMaxSeconds'), 500),
        ),
      },
    });

    applyResponse(response, 'success');
  } catch (error) {
    state.noticeText = toErrorMessage(error);
    state.noticeTone = 'danger';
  } finally {
    state.busyAction = null;
    render();
  }
}

async function handleAction(action: 'poll' | 'demo'): Promise<void> {
  state.busyAction = action;
  render();

  try {
    const response = await sendRequest({
      scope: 'remoteAutomation',
      type: action === 'poll' ? 'pollNow' : 'runDemoTask',
    });

    applyResponse(response, response.ok ? 'success' : 'danger');
  } catch (error) {
    state.noticeText = toErrorMessage(error);
    state.noticeTone = 'danger';
  } finally {
    state.busyAction = null;
    render();
  }
}

async function sendRequest(
  message: RemoteAutomationBackgroundRequest,
): Promise<RemoteAutomationBackgroundResponse> {
  return (await browser.runtime.sendMessage(
    message,
  )) as RemoteAutomationBackgroundResponse;
}

function applyResponse(
  response: RemoteAutomationBackgroundResponse,
  preferredTone: Exclude<NoticeTone, 'neutral'>,
): void {
  state.store = response.store;
  state.noticeText = response.ok
    ? response.result?.status === 'success'
      ? `${response.message} ${response.result.pageTitle}`
      : response.message
    : response.message;
  state.noticeTone = response.ok ? preferredTone : 'danger';
}

function getStatusLabel(): string {
  if (state.isLoading || !state.store) {
    return '加载中';
  }

  const { config, runtime } = state.store;
  if (!config.enabled) {
    return '未启用';
  }

  if (!config.serverBaseUrl) {
    return '待配置';
  }

  if (runtime.isPolling) {
    return '轮询中';
  }

  if (runtime.lastError) {
    return '异常';
  }

  return '在线';
}

function getStatusTone(): NoticeTone {
  if (state.isLoading || !state.store) {
    return 'neutral';
  }

  const { config, runtime } = state.store;
  if (!config.enabled || !config.serverBaseUrl) {
    return 'neutral';
  }

  return runtime.lastError ? 'danger' : 'success';
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '暂无';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

function formatOperationDelaySeconds(value: number): string {
  return (value / 1000).toFixed(1);
}

function parseOperationDelaySeconds(
  value: FormDataEntryValue | null,
  fallbackMs: number,
): number {
  const seconds = Number(value ?? fallbackMs / 1000);
  if (!Number.isFinite(seconds)) {
    return fallbackMs;
  }

  return Math.round(seconds * 1000);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
