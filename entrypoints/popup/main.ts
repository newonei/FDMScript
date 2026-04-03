import './style.css';

import type {
  RemoteAutomationBackgroundRequest,
  RemoteAutomationBackgroundResponse,
} from '@/utils/remoteAutomation';
import { createPddDemoPayload } from '@/automation/platforms/pdd/demo';

type PopupTab = 'domestic' | 'global';
type StatusTone = 'neutral' | 'success' | 'danger';

type PlatformCard = {
  id: string;
  label: string;
  url: string;
  tone: 'red' | 'orange' | 'blue' | 'navy' | 'white';
  variant:
    | 'pdd'
    | 'tmall'
    | 'taobao'
    | 'qianniu'
    | 'sycm'
    | '1688'
    | 'jd'
    | 'jingmai'
    | 'amazon'
    | 'ebay'
    | 'shop'
    | 'walmart';
  main: string;
  badge?: string;
  note?: string;
};

const DOMESTIC_PLATFORMS: PlatformCard[] = [
  {
    id: 'pdd-merchant',
    label: '拼多多商家',
    url: 'https://mms.pinduoduo.com/',
    tone: 'red',
    variant: 'pdd',
    main: '商',
    badge: '❤',
  },
  {
    id: 'pdd-center',
    label: '拼多多商家',
    url: 'https://mms.pinduoduo.com/',
    tone: 'red',
    variant: 'pdd',
    main: '家',
    badge: '❤',
  },
  {
    id: 'tmall',
    label: '天猫',
    url: 'https://www.tmall.com/',
    tone: 'red',
    variant: 'tmall',
    main: '天猫',
  },
  {
    id: 'tmall-global',
    label: '天猫国际',
    url: 'https://www.tmall.hk/',
    tone: 'navy',
    variant: 'tmall',
    main: '国际',
    badge: '全球',
  },
  {
    id: 'taobao',
    label: '天猫',
    url: 'https://www.tmall.com/',
    tone: 'orange',
    variant: 'taobao',
    main: '猫',
  },
  {
    id: 'qianniu',
    label: '千牛',
    url: 'https://work.taobao.com/',
    tone: 'blue',
    variant: 'qianniu',
    main: '牛',
  },
  {
    id: 'sycm',
    label: '生意参谋',
    url: 'https://sycm.taobao.com/',
    tone: 'blue',
    variant: 'sycm',
    main: '◌',
  },
  {
    id: '1688',
    label: '1688',
    url: 'https://www.1688.com/',
    tone: 'orange',
    variant: '1688',
    main: '1688',
    note: '搬',
  },
  {
    id: '1688-workbench',
    label: '商家工作台',
    url: 'https://work.1688.com/',
    tone: 'blue',
    variant: '1688',
    main: '1688',
  },
  {
    id: 'jd',
    label: '京东',
    url: 'https://www.jd.com/',
    tone: 'red',
    variant: 'jd',
    main: '京东',
  },
  {
    id: 'jd-global',
    label: '京东国际',
    url: 'https://www.jd.hk/',
    tone: 'red',
    variant: 'jd',
    main: '国际',
    note: '购',
  },
  {
    id: 'jingmai',
    label: '京麦',
    url: 'https://jm.jd.com/',
    tone: 'white',
    variant: 'jingmai',
    main: 'M',
  },
];

const GLOBAL_PLATFORMS: PlatformCard[] = [
  {
    id: 'amazon',
    label: 'Amazon',
    url: 'https://sellercentral.amazon.com/',
    tone: 'white',
    variant: 'amazon',
    main: 'a',
  },
  {
    id: 'ebay',
    label: 'eBay',
    url: 'https://www.ebay.com/',
    tone: 'white',
    variant: 'ebay',
    main: 'e',
  },
  {
    id: 'shopify',
    label: 'Shopify',
    url: 'https://www.shopify.com/',
    tone: 'blue',
    variant: 'shop',
    main: 'SHOP',
  },
  {
    id: 'walmart',
    label: 'Walmart',
    url: 'https://www.walmart.com/',
    tone: 'white',
    variant: 'walmart',
    main: 'WM',
  },
];

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Popup root #app was not found.');
}

const popupRoot = app;

let activeTab: PopupTab = 'domestic';
let isRunningPddDemo = false;
let statusTone: StatusTone = 'neutral';
let statusText = '拼多多上架示例已经准备好，可以直接从这里触发自动化测试。';

render();

function render(): void {
  const cards = activeTab === 'domestic' ? DOMESTIC_PLATFORMS : GLOBAL_PLATFORMS;

  popupRoot.innerHTML = `
    <main class="popup-shell">
      <section class="hero-banner">
        <div class="hero-banner__copy">
          <strong>飞德慕工具</strong>
          <span>本地插件工作台</span>
        </div>
        <div class="hero-banner__action">浏览器插件</div>
      </section>

      <section class="tab-panel">
        <div class="tabs">
          <button
            type="button"
            class="tab-button ${activeTab === 'domestic' ? 'is-active' : ''}"
            data-tab="domestic"
          >
            国内
          </button>
          <button
            type="button"
            class="tab-button ${activeTab === 'global' ? 'is-active' : ''}"
            data-tab="global"
          >
            国外
          </button>
        </div>

        <div class="platform-grid">
          ${cards
            .map(
              (card, index) => `
                <button
                  type="button"
                  class="platform-card"
                  data-url="${card.url}"
                  style="--item-index: ${index};"
                >
                  <span class="platform-icon platform-icon--${card.tone} platform-icon--${card.variant}">
                    ${card.badge ? `<span class="platform-icon__badge">${card.badge}</span>` : ''}
                    <span class="platform-icon__main">${card.main}</span>
                    ${card.note ? `<span class="platform-icon__note">${card.note}</span>` : ''}
                  </span>
                  <span class="platform-card__name">${card.label}</span>
                </button>
              `,
            )
            .join('')}
        </div>
      </section>

      <section class="automation-card">
        <div class="automation-card__head">
          <div class="automation-card__copy">
            <p>Automation</p>
            <strong>拼多多上架功能测试</strong>
          </div>
          <span class="automation-card__badge automation-card__badge--${statusTone}">
            ${statusTone === 'success' ? '完成' : statusTone === 'danger' ? '失败' : '就绪'}
          </span>
        </div>

        <p class="automation-card__detail">${escapeHtml(statusText)}</p>

        <div class="automation-card__actions">
          <button
            type="button"
            class="action-chip action-chip--accent"
            data-action="run-demo"
            ${isRunningPddDemo ? 'disabled' : ''}
          >
            ${isRunningPddDemo ? '执行中...' : '运行示例任务'}
          </button>
          <button type="button" class="action-chip" data-action="open-options">
            打开设置
          </button>
        </div>
      </section>
    </main>
  `;

  bindEvents();
}

function bindEvents(): void {
  popupRoot.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      activeTab = button.dataset.tab as PopupTab;
      render();
    });
  });

  popupRoot.querySelectorAll<HTMLButtonElement>('.platform-card').forEach((button) => {
    button.addEventListener('click', async () => {
      const url = button.dataset.url;
      if (!url) {
        return;
      }

      await browser.tabs.create({
        url,
        active: true,
      });
      window.close();
    });
  });

  popupRoot.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.action;

      if (action === 'run-demo') {
        void runPddDemo();
        return;
      }

      if (action === 'open-options') {
        void browser.runtime.openOptionsPage();
        window.close();
      }
    });
  });
}

async function runPddDemo(): Promise<void> {
  isRunningPddDemo = true;
  statusTone = 'neutral';
  statusText = '正在启动拼多多上架示例流程，请保持浏览器已经登录拼多多商家后台。';
  render();

  try {
    const response = await sendBackgroundRequest({
      scope: 'remoteAutomation',
      type: 'runPddPublishTask',
      payload: createPddDemoPayload(),
    });

    if (!response.ok) {
      statusTone = 'danger';
      statusText = response.message;
    } else if (response.result?.status === 'success') {
      statusTone = 'success';
      statusText = `示例流程执行完成，当前页面：${response.result.pageTitle || '拼多多商品页'}`;
    } else {
      statusTone = 'danger';
      statusText = response.message;
    }
  } catch (error) {
    statusTone = 'danger';
    statusText = toErrorMessage(error);
  } finally {
    isRunningPddDemo = false;
    render();
  }
}

async function sendBackgroundRequest(
  message: RemoteAutomationBackgroundRequest,
): Promise<RemoteAutomationBackgroundResponse> {
  return (await browser.runtime.sendMessage(
    message,
  )) as RemoteAutomationBackgroundResponse;
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
