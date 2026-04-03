export type PddProgressStepId =
  | 'init'
  | 'category'
  | 'images'
  | 'basic'
  | 'sku';

type PddProgressStepStatus = 'pending' | 'running' | 'success' | 'failed';

type PddProgressStep = {
  id: PddProgressStepId;
  label: string;
  status: PddProgressStepStatus;
};

const HOST_ID = 'fdm-pdd-progress-overlay';
const SUCCESS_AUTO_CLOSE_DELAY_MS = 1800;

const STEP_BLUEPRINT: PddProgressStep[] = [
  { id: 'init', label: '初始化', status: 'pending' },
  { id: 'category', label: '选择类目', status: 'pending' },
  { id: 'images', label: '图片上传', status: 'pending' },
  { id: 'basic', label: '填写基本属性', status: 'pending' },
  { id: 'sku', label: '填写 SKU 属性', status: 'pending' },
];

export class PddProgressOverlay {
  private host: HTMLDivElement;
  private shadowRoot: ShadowRoot;
  private steps: PddProgressStep[];
  private currentStepId: PddProgressStepId | null = null;
  private title = '正在初始化数据...';
  private detail = '准备开始自动化流程';
  private progressPercent = 0;
  private autoCloseTimer: number | null = null;
  private isDestroyed = false;

  constructor() {
    const existing = document.getElementById(HOST_ID);
    existing?.remove();

    this.host = document.createElement('div');
    this.host.id = HOST_ID;
    this.shadowRoot = this.host.attachShadow({ mode: 'open' });
    this.steps = STEP_BLUEPRINT.map((step) => ({ ...step }));
    document.body.append(this.host);
    this.render();
  }

  startStep(
    stepId: PddProgressStepId,
    title: string,
    progressPercent: number,
    detail = '',
  ): void {
    this.cancelAutoClose();
    this.currentStepId = stepId;
    this.setStepStatus(stepId, 'running');
    this.title = title;
    this.detail = detail;
    this.progressPercent = clampProgress(progressPercent);
    this.render();
  }

  update(title: string, progressPercent?: number, detail?: string): void {
    this.cancelAutoClose();
    this.title = title;
    if (typeof progressPercent === 'number') {
      this.progressPercent = clampProgress(progressPercent);
    }
    if (typeof detail === 'string') {
      this.detail = detail;
    }
    this.render();
  }

  completeStep(
    stepId: PddProgressStepId,
    title?: string,
    progressPercent?: number,
    detail?: string,
  ): void {
    this.cancelAutoClose();
    this.setStepStatus(stepId, 'success');
    if (this.currentStepId === stepId) {
      this.currentStepId = null;
    }
    if (title) {
      this.title = title;
    }
    if (typeof progressPercent === 'number') {
      this.progressPercent = clampProgress(progressPercent);
    }
    if (typeof detail === 'string') {
      this.detail = detail;
    }
    this.render();
  }

  failCurrent(errorMessage: string): void {
    this.cancelAutoClose();
    const failedStep =
      this.steps.find((step) => step.id === this.currentStepId) ??
      this.steps.find((step) => step.status === 'running') ??
      this.steps[0];

    failedStep.status = 'failed';
    this.currentStepId = failedStep.id;
    this.title = '当前步骤执行失败';
    this.detail = errorMessage;
    this.render();
  }

  finishSuccess(
    title = '飞德慕 AI 工具操作完成',
    detail = '当前基础信息填写流程已经执行完成。',
    autoCloseDelayMs = SUCCESS_AUTO_CLOSE_DELAY_MS,
  ): void {
    this.cancelAutoClose();
    if (this.currentStepId) {
      this.setStepStatus(this.currentStepId, 'success');
      this.currentStepId = null;
    }
    this.title = title;
    this.detail = detail;
    this.progressPercent = 100;
    this.render();
    this.scheduleAutoClose(autoCloseDelayMs);
  }

  destroy(): void {
    if (this.isDestroyed) {
      return;
    }

    this.cancelAutoClose();
    this.isDestroyed = true;
    this.host.remove();
  }

  private setStepStatus(
    stepId: PddProgressStepId,
    status: PddProgressStepStatus,
  ): void {
    const step = this.steps.find((item) => item.id === stepId);
    if (!step) {
      return;
    }

    step.status = status;
  }

  private getMetaText(): string {
    if (this.steps.some((step) => step.status === 'failed')) {
      return '执行失败';
    }

    if (this.steps.every((step) => step.status === 'success')) {
      return '已完成';
    }

    return '执行中';
  }

  private render(): void {
    if (this.isDestroyed) {
      return;
    }

    this.shadowRoot.innerHTML = `
      <style>${OVERLAY_STYLE}</style>
      <div class="fdm-progress-root">
        <div class="fdm-progress-mask"></div>

        <aside class="fdm-progress-panel" aria-label="进度提示">
          <header class="fdm-progress-panel__header">
            <div class="fdm-progress-panel__title">
              <span class="fdm-progress-panel__badge">飞</span>
              <strong>进度提示</strong>
            </div>
            <span class="fdm-progress-panel__meta">${escapeHtml(this.getMetaText())}</span>
          </header>

          <section class="fdm-progress-panel__table">
            <div class="fdm-progress-panel__row fdm-progress-panel__row--head">
              <span>步骤详情</span>
              <span>状态</span>
            </div>
            ${this.steps
              .map(
                (step) => `
                  <div class="fdm-progress-panel__row">
                    <span>${escapeHtml(step.label)}</span>
                    <span>${renderStatus(step.status)}</span>
                  </div>
                `,
              )
              .join('')}
          </section>

          <p class="fdm-progress-panel__hint">
            遇到问题时可以根据右侧状态快速定位当前执行阶段。
          </p>
        </aside>

        <section class="fdm-progress-modal" aria-live="polite">
          <h2>${escapeHtml(this.title)}</h2>
          <p>${escapeHtml(this.detail || '正在处理，请稍候...')}</p>

          <div class="fdm-progress-bar">
            <div class="fdm-progress-bar__fill" style="width: ${this.progressPercent}%;">
              <span>${this.progressPercent}%</span>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  private scheduleAutoClose(delayMs: number): void {
    this.cancelAutoClose();
    this.autoCloseTimer = window.setTimeout(() => {
      this.destroy();
    }, Math.max(0, delayMs));
  }

  private cancelAutoClose(): void {
    if (this.autoCloseTimer !== null) {
      window.clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = null;
    }
  }
}

function renderStatus(status: PddProgressStepStatus): string {
  switch (status) {
    case 'running':
      return '<span class="fdm-status fdm-status--running"></span>';
    case 'success':
      return '<span class="fdm-status fdm-status--success">&#10003;</span>';
    case 'failed':
      return '<span class="fdm-status fdm-status--failed">!</span>';
    default:
      return '<span class="fdm-status fdm-status--pending"></span>';
  }
}

function clampProgress(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const OVERLAY_STYLE = `
  :host {
    all: initial;
  }

  .fdm-progress-root {
    position: fixed;
    inset: 0;
    z-index: 2147483645;
    pointer-events: none;
    font-family: 'MiSans', 'PingFang SC', 'Microsoft YaHei UI', sans-serif;
  }

  .fdm-progress-mask {
    position: absolute;
    inset: 0;
    background: rgba(22, 25, 35, 0.18);
  }

  .fdm-progress-panel {
    position: fixed;
    top: 104px;
    right: 224px;
    width: 258px;
    border-radius: 8px;
    background: #ffffff;
    box-shadow: 0 24px 48px rgba(15, 23, 42, 0.18);
    overflow: hidden;
  }

  .fdm-progress-panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid #edf0f6;
  }

  .fdm-progress-panel__title {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #30384a;
    font-size: 16px;
  }

  .fdm-progress-panel__badge {
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 4px;
    background: linear-gradient(135deg, #ff9a25 0%, #ff7a00 100%);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
  }

  .fdm-progress-panel__meta {
    color: #98a1b3;
    font-size: 12px;
  }

  .fdm-progress-panel__table {
    display: flex;
    flex-direction: column;
  }

  .fdm-progress-panel__row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 56px;
    align-items: center;
    min-height: 48px;
    padding: 0 16px;
    border-bottom: 1px solid #edf0f6;
    color: #4a5568;
    font-size: 14px;
  }

  .fdm-progress-panel__row--head {
    min-height: 42px;
    background: #fafbfc;
    color: #8b95a7;
    font-weight: 600;
  }

  .fdm-progress-panel__hint {
    margin: 0;
    padding: 12px 16px 16px;
    color: #a0a8b7;
    font-size: 12px;
    line-height: 1.5;
  }

  .fdm-progress-modal {
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 540px;
    padding: 34px 40px 28px;
    border-radius: 14px;
    background: #ffffff;
    box-shadow: 0 28px 60px rgba(15, 23, 42, 0.22);
    text-align: center;
  }

  .fdm-progress-modal h2 {
    margin: 0;
    color: #272f3f;
    font-size: 22px;
    font-weight: 700;
  }

  .fdm-progress-modal p {
    margin: 12px 0 0;
    color: #8d97aa;
    font-size: 14px;
    line-height: 1.6;
  }

  .fdm-progress-bar {
    margin-top: 28px;
    height: 20px;
    border-radius: 999px;
    background: #edf1f7;
    overflow: hidden;
  }

  .fdm-progress-bar__fill {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    height: 100%;
    min-width: 44px;
    padding-right: 10px;
    border-radius: 999px;
    background: linear-gradient(90deg, #ff9b18 0%, #ff8518 100%);
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    transition: width 220ms ease;
  }

  .fdm-status {
    display: inline-grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
  }

  .fdm-status--pending {
    background: #e9edf3;
  }

  .fdm-status--running {
    position: relative;
    background: rgba(255, 148, 16, 0.14);
  }

  .fdm-status--running::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: #ff9410;
    animation: fdm-pulse 1.2s ease infinite;
  }

  .fdm-status--success {
    background: #27c45a;
    color: #fff;
  }

  .fdm-status--failed {
    background: #eb5757;
    color: #fff;
  }

  @keyframes fdm-pulse {
    0% {
      transform: scale(0.88);
      opacity: 0.72;
    }
    70% {
      transform: scale(1.12);
      opacity: 1;
    }
    100% {
      transform: scale(0.88);
      opacity: 0.72;
    }
  }
`;
