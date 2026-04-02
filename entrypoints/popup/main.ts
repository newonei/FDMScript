import './style.css';

type RegionKey = 'domestic' | 'global';

type Platform = {
  name: string;
  shortName: string;
  href: string;
  tone: 'orange' | 'red' | 'blue' | 'navy' | 'white';
  icon: 'pdd' | 'tmall' | 'taobao' | 'qianniu' | 'sycm' | '1688' | 'jd' | 'jingmai' | 'amazon' | 'ebay' | 'shop' | 'walmart';
  badge?: string;
  note?: string;
};

const platformGroups: Record<RegionKey, Platform[]> = {
  domestic: [
    {
      name: '拼多多商城',
      shortName: '多',
      href: 'https://mobile.yangkeduo.com/',
      tone: 'red',
      icon: 'pdd',
      badge: '商城',
    },
    {
      name: '拼多多商家',
      shortName: '多',
      href: 'https://mms.pinduoduo.com/',
      tone: 'red',
      icon: 'pdd',
      badge: '商家',
    },
    {
      name: '天猫',
      shortName: '天猫',
      href: 'https://www.tmall.com/',
      tone: 'red',
      icon: 'tmall',
    },
    {
      name: '天猫国际',
      shortName: 'CAT',
      href: 'https://www.tmall.hk/',
      tone: 'navy',
      icon: 'tmall',
      badge: '天猫国际',
    },
    {
      name: '淘宝',
      shortName: '淘',
      href: 'https://www.taobao.com/',
      tone: 'orange',
      icon: 'taobao',
    },
    {
      name: '千牛',
      shortName: '牛',
      href: 'https://work.taobao.com/',
      tone: 'blue',
      icon: 'qianniu',
    },
    {
      name: '生意参谋',
      shortName: '参',
      href: 'https://sycm.taobao.com/',
      tone: 'blue',
      icon: 'sycm',
      note: 'ROI',
    },
    {
      name: '1688',
      shortName: '1688',
      href: 'https://www.1688.com/',
      tone: 'orange',
      icon: '1688',
    },
    {
      name: '商家工作台',
      shortName: '1688',
      href: 'https://myseller.taobao.com/home.htm',
      tone: 'blue',
      icon: '1688',
    },
    {
      name: '京东',
      shortName: '京东',
      href: 'https://www.jd.com/',
      tone: 'red',
      icon: 'jd',
    },
    {
      name: '京东国际',
      shortName: 'JD',
      href: 'https://www.jd.hk/',
      tone: 'red',
      icon: 'jd',
      badge: '国际',
    },
    {
      name: '京麦',
      shortName: 'M',
      href: 'https://jingmai.jd.com/',
      tone: 'white',
      icon: 'jingmai',
    },
  ],
  global: [
    {
      name: 'Amazon',
      shortName: 'A',
      href: 'https://sellercentral.amazon.com/',
      tone: 'navy',
      icon: 'amazon',
      note: 'Seller',
    },
    {
      name: 'eBay',
      shortName: 'e',
      href: 'https://www.ebay.com/',
      tone: 'white',
      icon: 'ebay',
    },
    {
      name: 'AliExpress',
      shortName: 'AE',
      href: 'https://seller.aliexpress.com/',
      tone: 'orange',
      icon: 'shop',
    },
    {
      name: 'Temu Global',
      shortName: 'TEMU',
      href: 'https://seller.temu.com/',
      tone: 'orange',
      icon: 'shop',
    },
    {
      name: 'Shopee',
      shortName: 'S',
      href: 'https://seller.shopee.com/',
      tone: 'orange',
      icon: 'shop',
    },
    {
      name: 'Lazada',
      shortName: 'LZD',
      href: 'https://sellercenter.lazada.com/',
      tone: 'blue',
      icon: 'shop',
    },
    {
      name: 'TikTok Shop',
      shortName: 'TT',
      href: 'https://seller.tiktokglobalshop.com/',
      tone: 'navy',
      icon: 'shop',
    },
    {
      name: 'Walmart',
      shortName: 'W',
      href: 'https://seller.walmart.com/',
      tone: 'blue',
      icon: 'walmart',
    },
    {
      name: 'Etsy',
      shortName: 'E',
      href: 'https://www.etsy.com/sell',
      tone: 'orange',
      icon: 'shop',
    },
    {
      name: 'Shopify',
      shortName: 'S',
      href: 'https://www.shopify.com/',
      tone: 'white',
      icon: 'shop',
      note: 'Plus',
    },
    {
      name: 'Mercado Libre',
      shortName: 'ML',
      href: 'https://www.mercadolibre.com/',
      tone: 'orange',
      icon: 'shop',
    },
    {
      name: 'Ozon',
      shortName: 'OZ',
      href: 'https://seller.ozon.ru/',
      tone: 'blue',
      icon: 'shop',
    },
  ],
};

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Popup root #app was not found.');
}

function getIconMarkup(platform: Platform): string {
  const badge = platform.badge
    ? `<span class="platform-icon__badge">${platform.badge}</span>`
    : '';
  const note = platform.note
    ? `<span class="platform-icon__note">${platform.note}</span>`
    : '';

  return `
    <div class="platform-icon platform-icon--${platform.tone} platform-icon--${platform.icon}">
      ${badge}
      <span class="platform-icon__main">${platform.shortName}</span>
      ${note}
    </div>
  `;
}

function getPlatformMarkup(platform: Platform, index: number): string {
  return `
    <a
      class="platform-card"
      href="${platform.href}"
      target="_blank"
      rel="noreferrer"
      style="--item-index: ${index};"
    >
      ${getIconMarkup(platform)}
      <span class="platform-card__name">${platform.name}</span>
    </a>
  `;
}

function render(activeRegion: RegionKey): void {
  const tabLabel =
    activeRegion === 'domestic' ? '国内平台导航' : '海外平台导航';

  app.innerHTML = `
    <main class="popup-shell">
      <a
        class="hero-banner"
        href="https://www.mouchenjie.com"
        target="_blank"
        rel="noreferrer"
      >
        <div class="hero-banner__copy">
          <strong>谋臣界·电商AI工具</strong>
          <span>www.mouchenjie.com</span>
        </div>
        <span class="hero-banner__action">进入官网 &gt;</span>
      </a>

      <section class="tab-panel" aria-label="${tabLabel}">
        <div class="tabs" role="tablist" aria-label="平台范围">
          <button
            type="button"
            class="tab-button ${activeRegion === 'domestic' ? 'is-active' : ''}"
            data-region="domestic"
            aria-selected="${activeRegion === 'domestic'}"
            role="tab"
          >
            国内
          </button>
          <button
            type="button"
            class="tab-button ${activeRegion === 'global' ? 'is-active' : ''}"
            data-region="global"
            aria-selected="${activeRegion === 'global'}"
            role="tab"
          >
            国外
          </button>
        </div>

        <div class="platform-grid">
          ${platformGroups[activeRegion]
            .map((platform, index) => getPlatformMarkup(platform, index))
            .join('')}
        </div>
      </section>
    </main>
  `;

  app.querySelectorAll<HTMLButtonElement>('.tab-button').forEach((button) => {
    button.addEventListener('click', () => {
      const nextRegion = button.dataset.region as RegionKey;
      if (nextRegion !== activeRegion) {
        render(nextRegion);
      }
    });
  });
}

render('domestic');
