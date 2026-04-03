import type {
  RemoteAutomationWaitForSelectorStep,
} from '@/utils/remoteAutomation';
import {
  REMOTE_AUTOMATION_STORE_KEY,
  clampOperationDelayMs,
} from '@/utils/remoteAutomation';

type OperationDelayRange = {
  minMs: number;
  maxMs: number;
};

const DEFAULT_OPERATION_DELAY_RANGE: OperationDelayRange = {
  minMs: 300,
  maxMs: 500,
};

let cachedOperationDelayRange: OperationDelayRange = {
  ...DEFAULT_OPERATION_DELAY_RANGE,
};
let hasLoadedOperationDelayRange = false;
let loadingOperationDelayRange: Promise<OperationDelayRange> | null = null;

browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !(REMOTE_AUTOMATION_STORE_KEY in changes)) {
    return;
  }

  cachedOperationDelayRange = readOperationDelayRange(
    changes[REMOTE_AUTOMATION_STORE_KEY]?.newValue as
      | { config?: { operationDelayMinMs?: number; operationDelayMaxMs?: number } }
      | undefined,
  );
  hasLoadedOperationDelayRange = true;
});

export async function waitForElement(
  step: RemoteAutomationWaitForSelectorStep,
  logs: string[],
): Promise<Element> {
  const timeoutMs = step.timeoutMs ?? 10_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const element = document.querySelector(step.selector);
    if (element && (!step.visible || isElementVisible(element))) {
      logs.push(`Found selector "${step.selector}".`);
      return element;
    }

    await delay(100);
  }

  throw new Error(
    `Could not find selector "${step.selector}" within ${timeoutMs}ms.`,
  );
}

export async function waitForCondition<T>(
  factory: () => T | null | undefined,
  timeoutMs: number,
  message: string,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const value = factory();
    if (value) {
      return value;
    }

    await delay(120);
  }

  throw new Error(message);
}

export async function waitForDocumentReady(): Promise<void> {
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    return;
  }

  await new Promise<void>((resolve) => {
    const onReadyStateChange = () => {
      if (
        document.readyState === 'complete' ||
        document.readyState === 'interactive'
      ) {
        document.removeEventListener('readystatechange', onReadyStateChange);
        resolve();
      }
    };

    document.addEventListener('readystatechange', onReadyStateChange);
  });
}

export function clickHTMLElement(element: HTMLElement): void {
  element.scrollIntoView({
    block: 'center',
    inline: 'nearest',
    behavior: 'auto',
  });
  element.focus?.({ preventScroll: true });
  element.click();
}

export function activateInputElement(
  element: HTMLInputElement | HTMLTextAreaElement,
): void {
  element.scrollIntoView({
    block: 'center',
    inline: 'nearest',
    behavior: 'auto',
  });

  element.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      composed: true,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
    }),
  );
  element.dispatchEvent(
    new MouseEvent('mousedown', {
      bubbles: true,
      composed: true,
      button: 0,
    }),
  );
  element.focus({ preventScroll: true });
  element.dispatchEvent(
    new MouseEvent('mouseup', {
      bubbles: true,
      composed: true,
      button: 0,
    }),
  );
  element.dispatchEvent(
    new PointerEvent('pointerup', {
      bubbles: true,
      composed: true,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
    }),
  );
  element.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      composed: true,
      button: 0,
    }),
  );
  element.select?.();
}

export function setElementValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;

  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

export function setContentEditableValue(
  element: HTMLElement,
  value: string,
): void {
  element.textContent = value;
  element.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      composed: true,
      data: value,
      inputType: 'insertText',
    }),
  );
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

export function isElementVisible(element: Element): boolean {
  if (!(element instanceof HTMLElement)) {
    return true;
  }

  const style = window.getComputedStyle(element);
  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    style.opacity === '0'
  ) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function findButtonByText(
  root: ParentNode,
  text: string,
): HTMLElement | null {
  const buttons = Array.from(
    root.querySelectorAll<HTMLElement>('button, a[role="button"], a'),
  );
  const normalizedTarget = normalizeText(text);
  return (
    buttons.find((button) =>
      normalizeText(button.textContent).includes(normalizedTarget),
    ) ?? null
  );
}

export async function waitForListboxOption(text: string): Promise<HTMLElement> {
  const target = normalizeText(text);

  return waitForCondition(() => {
    const options = Array.from(
      document.querySelectorAll<HTMLElement>('ul[role="listbox"] li[role="option"]'),
    );

    return (
      options.find(
        (option) => normalizeText(option.textContent) === target,
      ) ?? null
    );
  }, 10_000, `Waiting for the dropdown option "${text}".`);
}

export function normalizeText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function waitForRandomOperationDelay(
  override?: Partial<OperationDelayRange>,
): Promise<number> {
  const baseRange = await getOperationDelayRange();
  const minMs = clampOperationDelayMs(override?.minMs ?? baseRange.minMs);
  const maxMs = clampOperationDelayMs(override?.maxMs ?? baseRange.maxMs);
  const normalizedMaxMs = Math.max(minMs, maxMs);
  const waitMs =
    minMs === normalizedMaxMs
      ? minMs
      : Math.round(minMs + Math.random() * (normalizedMaxMs - minMs));

  await delay(waitMs);
  return waitMs;
}

async function getOperationDelayRange(): Promise<OperationDelayRange> {
  if (hasLoadedOperationDelayRange) {
    return cachedOperationDelayRange;
  }

  if (!loadingOperationDelayRange) {
    loadingOperationDelayRange = browser.storage.local
      .get(REMOTE_AUTOMATION_STORE_KEY)
      .then((stored) => {
        cachedOperationDelayRange = readOperationDelayRange(
          stored[REMOTE_AUTOMATION_STORE_KEY] as
            | { config?: { operationDelayMinMs?: number; operationDelayMaxMs?: number } }
            | undefined,
        );
        hasLoadedOperationDelayRange = true;
        return cachedOperationDelayRange;
      })
      .catch(() => {
        hasLoadedOperationDelayRange = true;
        cachedOperationDelayRange = { ...DEFAULT_OPERATION_DELAY_RANGE };
        return cachedOperationDelayRange;
      })
      .finally(() => {
        loadingOperationDelayRange = null;
      });
  }

  return loadingOperationDelayRange;
}

function readOperationDelayRange(
  store:
    | { config?: { operationDelayMinMs?: number; operationDelayMaxMs?: number } }
    | undefined,
): OperationDelayRange {
  const minMs = clampOperationDelayMs(
    store?.config?.operationDelayMinMs ?? DEFAULT_OPERATION_DELAY_RANGE.minMs,
  );
  const maxMs = clampOperationDelayMs(
    store?.config?.operationDelayMaxMs ?? DEFAULT_OPERATION_DELAY_RANGE.maxMs,
  );

  return {
    minMs,
    maxMs: Math.max(minMs, maxMs),
  };
}
