import type {
  RemoteAutomationBackgroundRequest,
  RemoteAutomationBackgroundResponse,
} from '@/utils/remoteAutomation';
import { createPddDemoPayload } from '@/automation/platforms/pdd/demo';

type PlatformKey = 'pdd' | 'taobao' | 'jd';
type StatusTone = 'neutral' | 'success' | 'danger';
type ToolAction = 'placeholder' | 'openOptions';

type ToolItem = {
  id: string;
  label: string;
  icon: string;
  action: ToolAction;
};

type PlatformOption = {
  key: PlatformKey;
  label: string;
  homeUrl: string;
  demoTitle: string;
  demoDescription: string;
  defaultStatus: string;
  pendingStatus: string;
  unavailableStatus?: string;
  successPageLabel: string;
};

const HOST_ID = 'fdm-floating-workbench-host';

const PLATFORM_OPTIONS: PlatformOption[] = [
  {
    key: 'pdd',
    label: '拼多多',
    homeUrl: 'https://mms.pinduoduo.com/',
    demoTitle: '拼多多上架示例',
    demoDescription:
      '打开商品发布页，自动填写类目、标题、图片、规格和 SKU 示例数据。',
    defaultStatus:
      '当前已切换到拼多多上架示例，点击后会直接启动拼多多商品发布演示流程。',
    pendingStatus:
      '正在启动拼多多上架示例流程，请保持浏览器已经登录拼多多商家后台。',
    successPageLabel: '拼多多商品页',
  },
  {
    key: 'taobao',
    label: '天猫',
    homeUrl: 'https://www.tmall.com/',
    demoTitle: '天猫上架示例',
    demoDescription:
      '预留天猫商品发布演示入口，后续会接入天猫发布页自动化流程。',
    defaultStatus:
      '当前已切换到天猫上架示例，入口已经预留，后续接入后可直接从这里触发。',
    pendingStatus: '天猫上架示例入口已切换完成，当前自动化流程正在接入中。',
    unavailableStatus:
      '天猫上架示例入口已显示，但当前版本还没有接入自动化执行逻辑。',
    successPageLabel: '天猫商品页',
  },
  {
    key: 'jd',
    label: '京东',
    homeUrl: 'https://shop.jd.com/',
    demoTitle: '京东上架示例',
    demoDescription:
      '预留京东商品发布演示入口，后续会接入京东商家后台自动化流程。',
    defaultStatus:
      '当前已切换到京东上架示例，入口已经预留，后续接入后可直接从这里触发。',
    pendingStatus: '京东上架示例入口已切换完成，当前自动化流程正在接入中。',
    unavailableStatus:
      '京东上架示例入口已显示，但当前版本还没有接入自动化执行逻辑。',
    successPageLabel: '京东商品页',
  },
];

const TOOL_ITEMS: ToolItem[] = [
  { id: 'download', label: '下载工具', icon: '下', action: 'placeholder' },
];

export function mountFloatingWorkbench(): void {
  if (window.top !== window) {
    return;
  }

  if (!document.body) {
    window.addEventListener(
      'DOMContentLoaded',
      () => {
        mountFloatingWorkbench();
      },
      { once: true },
    );
    return;
  }

  if (document.getElementById(HOST_ID)) {
    return;
  }

  const host = document.createElement('div');
  host.id = HOST_ID;
  const shadowRoot = host.attachShadow({ mode: 'open' });
  document.body.append(host);

  let selectedPlatform: PlatformKey = 'pdd';
  let isExpanded = shouldExpandInitially(window.location.hostname);
  let isRunningDemo = false;
  let statusTone: StatusTone = 'neutral';
  let statusText = getPlatformOption(selectedPlatform).defaultStatus;

  render();

  function render(): void {
    const currentPlatform = getPlatformOption(selectedPlatform);

    shadowRoot.innerHTML = `
      <style>${FLOATING_WORKBENCH_STYLE}</style>
      <div class="fdm-root ${isExpanded ? 'is-expanded' : ''}">
        <button type="button" class="fdm-launcher" data-action="toggle">飞德慕</button>

        <aside class="fdm-panel" aria-label="飞德慕悬浮工作台">
          <section class="fdm-banner">
            <div class="fdm-banner__copy">
              <strong>飞德慕工具</strong>
              <span>LOCAL WORKBENCH</span>
            </div>
            <div class="fdm-banner__actions">
              <button type="button" class="fdm-banner__icon" data-action="open-options">i</button>
              <button type="button" class="fdm-banner__icon" data-action="toggle">-</button>
            </div>
          </section>

          <section class="fdm-toolbar">
            <label class="fdm-toolbar__select">
              <select data-role="platform-select" aria-label="选择平台">
                ${PLATFORM_OPTIONS.map(
                  (option) => `
                    <option value="${option.key}" ${option.key === selectedPlatform ? 'selected' : ''}>
                      ${option.label}
                    </option>
                  `,
                ).join('')}
              </select>
            </label>
            <button type="button" class="fdm-toolbar__home" data-action="go-home">返回首页</button>
          </section>

          <section class="fdm-feature">
            <div class="fdm-feature__copy">
              <p class="fdm-feature__eyebrow">功能测试</p>
              <strong>${escapeHtml(currentPlatform.demoTitle)}</strong>
              <span>${escapeHtml(currentPlatform.demoDescription)}</span>
            </div>
            <button
              type="button"
              class="fdm-feature__button"
              data-action="run-platform-demo"
              ${isRunningDemo ? 'disabled' : ''}
            >
              ${isRunningDemo ? '执行中...' : '立即测试'}
            </button>
          </section>

          <section class="fdm-status fdm-status--${statusTone}">
            ${escapeHtml(statusText)}
          </section>

          <nav class="fdm-menu" aria-label="工具菜单">
            ${TOOL_ITEMS.map(
              (item) => `
                <button type="button" class="fdm-menu__item" data-tool-id="${item.id}">
                  <span class="fdm-menu__icon">${item.icon}</span>
                  <span class="fdm-menu__label">${escapeHtml(item.label)}</span>
                  <span class="fdm-menu__chevron">&gt;</span>
                </button>
              `,
            ).join('')}
          </nav>

          <footer class="fdm-footer">
            <button type="button" class="fdm-footer__bundle" data-action="run-platform-demo">
              <span class="fdm-footer__nodes">示</span>
              <span>${escapeHtml(currentPlatform.demoTitle)}</span>
              <span class="fdm-footer__arrow">&gt;</span>
            </button>
          </footer>
        </aside>
      </div>
    `;

    bindEvents();
  }

  function bindEvents(): void {
    shadowRoot
      .querySelector<HTMLSelectElement>('[data-role="platform-select"]')
      ?.addEventListener('change', (event) => {
        const target = event.currentTarget as HTMLSelectElement;
        selectedPlatform = target.value as PlatformKey;
        statusTone = 'neutral';
        statusText = getPlatformOption(selectedPlatform).defaultStatus;
        render();
      });

    shadowRoot.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.action;

        if (action === 'toggle') {
          isExpanded = !isExpanded;
          render();
          return;
        }

        if (action === 'go-home') {
          goHome();
          return;
        }

        if (action === 'open-options') {
          void openOptions();
          return;
        }

        if (action === 'run-platform-demo') {
          void runSelectedPlatformDemo();
        }
      });
    });

    shadowRoot.querySelectorAll<HTMLButtonElement>('.fdm-menu__item').forEach((button) => {
      button.addEventListener('click', () => {
        const tool = TOOL_ITEMS.find((item) => item.id === button.dataset.toolId);
        if (!tool) {
          return;
        }

        if (tool.action === 'openOptions') {
          void openOptions();
          return;
        }

        updateStatus('neutral', `${tool.label} 入口已经预留，后面可以继续接入具体自动化能力。`);
      });
    });
  }

  function goHome(): void {
    const platform = getPlatformOption(selectedPlatform);
    window.open(platform.homeUrl, '_blank', 'noopener,noreferrer');
  }

  async function openOptions(): Promise<void> {
    await browser.runtime.openOptionsPage();
  }

  async function runSelectedPlatformDemo(): Promise<void> {
    const currentPlatform = getPlatformOption(selectedPlatform);

    if (currentPlatform.key === 'pdd') {
      isRunningDemo = true;
      updateStatus('neutral', currentPlatform.pendingStatus, false);
      render();

      try {
        const response = await sendBackgroundRequest({
          scope: 'remoteAutomation',
          type: 'runPddPublishTask',
          payload: createPddDemoPayload(),
        });

        if (!response.ok) {
          updateStatus('danger', response.result?.error ?? response.message, false);
        } else if (response.result?.status === 'success') {
          updateStatus(
            'success',
            `示例流程执行完成，当前页面：${
              response.result.pageTitle || currentPlatform.successPageLabel
            }`,
            false,
          );
        } else {
          updateStatus('danger', response.result?.error ?? response.message, false);
        }
      } catch (error) {
        updateStatus('danger', toErrorMessage(error), false);
      } finally {
        isRunningDemo = false;
        render();
      }
      return;
    }

    if (currentPlatform.unavailableStatus) {
      updateStatus('neutral', currentPlatform.unavailableStatus);
    }
  }

  async function sendBackgroundRequest(
    message: RemoteAutomationBackgroundRequest,
  ): Promise<RemoteAutomationBackgroundResponse> {
    return (await browser.runtime.sendMessage(
      message,
    )) as RemoteAutomationBackgroundResponse;
  }

  function updateStatus(
    tone: StatusTone,
    message: string,
    shouldRender = true,
  ): void {
    statusTone = tone;
    statusText = message;

    if (shouldRender) {
      render();
    }
  }
}

function getPlatformOption(platformKey: PlatformKey): PlatformOption {
  return (
    PLATFORM_OPTIONS.find((option) => option.key === platformKey) ??
    PLATFORM_OPTIONS[0]
  );
}

function shouldExpandInitially(hostname: string): boolean {
  const normalizedHost = hostname.toLowerCase();
  return ['pinduoduo.com', 'taobao.com', 'tmall.com', 'jd.com'].some((domain) =>
    normalizedHost.includes(domain),
  );
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

const FLOATING_WORKBENCH_STYLE = `
  :host {
    all: initial;
  }

  .fdm-root {
    position: fixed;
    right: 16px;
    top: 88px;
    z-index: 2147483646;
    pointer-events: none;
    font-family: 'MiSans', 'PingFang SC', 'Microsoft YaHei UI', sans-serif;
  }

  .fdm-launcher,
  .fdm-panel {
    pointer-events: auto;
  }

  .fdm-launcher {
    border: 0;
    border-radius: 999px;
    padding: 10px 14px;
    color: #fff8ed;
    background: linear-gradient(135deg, #ff8f1f 0%, #f59b32 100%);
    box-shadow: 0 14px 30px rgba(44, 35, 22, 0.22);
    cursor: pointer;
  }

  .fdm-root.is-expanded .fdm-launcher {
    display: none;
  }

  .fdm-panel {
    display: none;
    width: 188px;
    border-radius: 12px;
    background: linear-gradient(180deg, #ffffff 0%, #f8f7f4 100%);
    border: 1px solid rgba(255, 255, 255, 0.74);
    box-shadow: 0 16px 36px rgba(44, 35, 22, 0.22);
    overflow: hidden;
    color: #45413a;
  }

  .fdm-root.is-expanded .fdm-panel {
    display: block;
  }

  .fdm-banner {
    position: relative;
    margin: 8px;
    padding: 12px 12px 10px;
    border-radius: 8px;
    background:
      radial-gradient(circle, rgba(255, 255, 255, 0.24) 1px, transparent 1.2px),
      linear-gradient(135deg, #ff8f1f 0%, #f59b32 100%);
    background-size: 5px 5px, auto;
    color: #fff8ed;
  }

  .fdm-banner__copy {
    display: grid;
    gap: 4px;
  }

  .fdm-banner__copy strong {
    font-size: 13px;
    line-height: 1.15;
    font-weight: 700;
  }

  .fdm-banner__copy span {
    font-size: 8px;
    letter-spacing: 0.32em;
    opacity: 0.92;
  }

  .fdm-banner__actions {
    position: absolute;
    top: 6px;
    right: 6px;
    display: flex;
    gap: 4px;
  }

  .fdm-banner__icon {
    width: 16px;
    height: 16px;
    border: 1px solid rgba(255, 247, 233, 0.86);
    border-radius: 999px;
    padding: 0;
    color: #fff8ed;
    background: rgba(255, 255, 255, 0.08);
    cursor: pointer;
  }

  .fdm-toolbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    margin: 0 8px;
    border: 1px solid #eadfcb;
    border-radius: 8px;
    overflow: hidden;
    background: #fffaf2;
  }

  .fdm-toolbar__select {
    position: relative;
  }

  .fdm-toolbar__select::after {
    content: 'v';
    position: absolute;
    top: 50%;
    right: 10px;
    transform: translateY(-50%);
    font-size: 12px;
    color: #8a7f72;
    pointer-events: none;
  }

  .fdm-toolbar__select select {
    width: 100%;
    border: 0;
    padding: 9px 28px 9px 12px;
    background: transparent;
    color: #45413a;
    outline: none;
    appearance: none;
  }

  .fdm-toolbar__home {
    border: 0;
    border-left: 1px solid #eadfcb;
    padding: 0 12px;
    color: #b35016;
    background: transparent;
    cursor: pointer;
  }

  .fdm-feature {
    display: grid;
    gap: 8px;
    margin: 10px 8px 0;
    padding: 10px;
    border-radius: 10px;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(255, 247, 235, 0.98));
    border: 1px solid rgba(240, 185, 119, 0.45);
  }

  .fdm-feature__copy {
    display: grid;
    gap: 4px;
  }

  .fdm-feature__eyebrow {
    margin: 0;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: #c46a1a;
  }

  .fdm-feature__copy strong {
    font-size: 13px;
    line-height: 1.2;
  }

  .fdm-feature__copy span {
    font-size: 11px;
    line-height: 1.45;
    color: #7a6e5f;
  }

  .fdm-feature__button {
    border: 0;
    border-radius: 999px;
    padding: 8px 12px;
    color: #fffaf3;
    background: linear-gradient(135deg, #f69227 0%, #e87d13 100%);
    cursor: pointer;
  }

  .fdm-feature__button:disabled {
    opacity: 0.72;
    cursor: wait;
  }

  .fdm-status {
    margin: 10px 8px 0;
    padding: 8px 10px;
    border-radius: 8px;
    font-size: 11px;
    line-height: 1.5;
    border: 1px solid transparent;
  }

  .fdm-status--neutral {
    color: #6f675c;
    background: #f6f2eb;
    border-color: #ece0d2;
  }

  .fdm-status--success {
    color: #226445;
    background: #ebf8f0;
    border-color: #bfe0cc;
  }

  .fdm-status--danger {
    color: #9d4335;
    background: #fbeceb;
    border-color: #f0c6c1;
  }

  .fdm-menu {
    display: flex;
    flex-direction: column;
    margin-top: 8px;
  }

  .fdm-menu__item {
    display: grid;
    grid-template-columns: 22px minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    min-height: 46px;
    border: 0;
    border-top: 1px solid rgba(121, 107, 84, 0.14);
    padding: 0 14px;
    background: transparent;
    color: #45413a;
    text-align: left;
    cursor: pointer;
  }

  .fdm-menu__item:hover {
    background: rgba(255, 255, 255, 0.55);
  }

  .fdm-menu__icon {
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 6px;
    background: linear-gradient(135deg, #f6efe4 0%, #ebe2d2 100%);
    color: #7b6c59;
    font-size: 11px;
    font-weight: 700;
  }

  .fdm-menu__label {
    font-size: 14px;
  }

  .fdm-menu__chevron {
    font-size: 14px;
    color: #746a5e;
  }

  .fdm-footer {
    padding: 8px;
  }

  .fdm-footer__bundle {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr) 18px;
    align-items: center;
    gap: 8px;
    width: 100%;
    border: 0;
    border-radius: 10px;
    padding: 9px 10px;
    color: #60564a;
    background: rgba(255, 255, 255, 0.66);
    cursor: pointer;
  }

  .fdm-footer__nodes {
    color: #7b7268;
    font-size: 11px;
  }

  .fdm-footer__arrow {
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 999px;
    color: #fff8f0;
    background: linear-gradient(135deg, #f9b24b 0%, #f1870f 100%);
  }
`;
