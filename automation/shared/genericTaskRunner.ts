import type {
  RemoteAutomationClickStep,
  RemoteAutomationExecutionResult,
  RemoteAutomationExtractAttributeStep,
  RemoteAutomationExtractTextStep,
  RemoteAutomationPressStep,
  RemoteAutomationScrollIntoViewStep,
  RemoteAutomationSelectStep,
  RemoteAutomationStep,
  RemoteAutomationTask,
  RemoteAutomationTypeStep,
} from '@/utils/remoteAutomation';
import {
  clickHTMLElement,
  delay,
  setContentEditableValue,
  setElementValue,
  toErrorMessage,
  waitForElement,
  waitForRandomOperationDelay,
} from '@/automation/shared/dom';

export async function runGenericAutomationTask(
  task: RemoteAutomationTask,
): Promise<RemoteAutomationExecutionResult> {
  const extracted: Record<string, string> = {};
  const logs: string[] = [`Started generic task ${task.id} on ${window.location.href}`];
  let completedSteps = 0;

  try {
    const steps = task.steps ?? [];

    for (const [index, step] of steps.entries()) {
      logs.push(`Step ${index + 1}: ${step.type}`);
      await executeStep(step, extracted, logs);
      completedSteps = index + 1;
    }

    logs.push('Task completed successfully.');

    return {
      ok: true,
      pageUrl: window.location.href,
      pageTitle: document.title,
      extracted,
      logs,
      completedSteps,
    };
  } catch (error) {
    const message = toErrorMessage(error);
    logs.push(`Task failed: ${message}`);

    return {
      ok: false,
      pageUrl: window.location.href,
      pageTitle: document.title,
      extracted,
      logs,
      completedSteps,
      error: message,
    };
  }
}

async function executeStep(
  step: RemoteAutomationStep,
  extracted: Record<string, string>,
  logs: string[],
): Promise<void> {
  switch (step.type) {
    case 'wait':
      logs.push(`Waiting ${step.ms}ms.`);
      await delay(step.ms);
      return;

    case 'waitForSelector':
      await waitForElement(step, logs);
      return;

    case 'click':
      await clickElement(step, logs);
      return;

    case 'type':
      await typeIntoElement(step, logs);
      return;

    case 'select':
      await selectOption(step, logs);
      return;

    case 'scrollIntoView':
      await scrollElementIntoView(step, logs);
      return;

    case 'press':
      await pressKey(step, logs);
      return;

    case 'extractText':
      await extractText(step, extracted, logs);
      return;

    case 'extractAttribute':
      await extractAttribute(step, extracted, logs);
      return;
  }
}

async function clickElement(
  step: RemoteAutomationClickStep,
  logs: string[],
): Promise<void> {
  const element = await waitForElement(
    {
      type: 'waitForSelector',
      selector: step.selector,
      timeoutMs: step.timeoutMs,
      visible: true,
    },
    logs,
  );

  if (!(element instanceof HTMLElement)) {
    throw new Error(`Selector "${step.selector}" is not clickable.`);
  }

  clickHTMLElement(element);
  logs.push(`Clicked "${step.selector}".`);

  if (step.waitAfterMs) {
    await delay(step.waitAfterMs);
  } else {
    await waitForRandomOperationDelay();
  }
}

async function typeIntoElement(
  step: RemoteAutomationTypeStep,
  logs: string[],
): Promise<void> {
  const element = await waitForElement(
    {
      type: 'waitForSelector',
      selector: step.selector,
      timeoutMs: step.timeoutMs,
      visible: true,
    },
    logs,
  );

  if (
    !(element instanceof HTMLInputElement) &&
    !(element instanceof HTMLTextAreaElement) &&
    !(element instanceof HTMLElement && element.isContentEditable)
  ) {
    throw new Error(
      `Selector "${step.selector}" does not point to a supported text field.`,
    );
  }

  if (element instanceof HTMLElement) {
    element.focus({ preventScroll: true });
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const initialValue = step.clear === false ? element.value : '';

    if (step.delayMs && step.delayMs > 0) {
      setElementValue(element, initialValue);

      let currentValue = initialValue;
      for (const character of step.text) {
        currentValue += character;
        setElementValue(element, currentValue);
        await delay(step.delayMs);
      }
    } else {
      setElementValue(
        element,
        step.clear === false ? `${element.value}${step.text}` : step.text,
      );
    }
  } else {
    const initialValue = step.clear === false ? element.textContent ?? '' : '';

    if (step.delayMs && step.delayMs > 0) {
      setContentEditableValue(element, initialValue);

      let currentValue = initialValue;
      for (const character of step.text) {
        currentValue += character;
        setContentEditableValue(element, currentValue);
        await delay(step.delayMs);
      }
    } else {
      setContentEditableValue(
        element,
        step.clear === false ? `${element.textContent ?? ''}${step.text}` : step.text,
      );
    }
  }

  await waitForRandomOperationDelay();
  logs.push(`Filled "${step.selector}" with ${step.text.length} characters.`);
}

async function selectOption(
  step: RemoteAutomationSelectStep,
  logs: string[],
): Promise<void> {
  const element = await waitForElement(
    {
      type: 'waitForSelector',
      selector: step.selector,
      timeoutMs: step.timeoutMs,
      visible: true,
    },
    logs,
  );

  if (!(element instanceof HTMLSelectElement)) {
    throw new Error(`Selector "${step.selector}" is not a <select> element.`);
  }

  const optionExists = Array.from(element.options).some(
    (option) => option.value === step.value,
  );

  if (!optionExists) {
    throw new Error(
      `Option "${step.value}" was not found in selector "${step.selector}".`,
    );
  }

  element.value = step.value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  await waitForRandomOperationDelay();
  logs.push(`Selected "${step.value}" in "${step.selector}".`);
}

async function scrollElementIntoView(
  step: RemoteAutomationScrollIntoViewStep,
  logs: string[],
): Promise<void> {
  const element = await waitForElement(
    {
      type: 'waitForSelector',
      selector: step.selector,
      timeoutMs: step.timeoutMs,
      visible: false,
    },
    logs,
  );

  if (!(element instanceof HTMLElement)) {
    throw new Error(`Selector "${step.selector}" is not scrollable.`);
  }

  element.scrollIntoView({
    block: 'center',
    inline: 'nearest',
    behavior: 'auto',
  });
  await waitForRandomOperationDelay();
  logs.push(`Scrolled "${step.selector}" into view.`);
}

async function pressKey(
  step: RemoteAutomationPressStep,
  logs: string[],
): Promise<void> {
  const element = await waitForElement(
    {
      type: 'waitForSelector',
      selector: step.selector,
      timeoutMs: step.timeoutMs,
      visible: true,
    },
    logs,
  );

  if (!(element instanceof HTMLElement)) {
    throw new Error(`Selector "${step.selector}" cannot receive keyboard input.`);
  }

  element.focus({ preventScroll: true });

  const keyboardEventInit: KeyboardEventInit = {
    key: step.key,
    bubbles: true,
    cancelable: true,
    composed: true,
  };

  element.dispatchEvent(new KeyboardEvent('keydown', keyboardEventInit));
  element.dispatchEvent(new KeyboardEvent('keypress', keyboardEventInit));
  element.dispatchEvent(new KeyboardEvent('keyup', keyboardEventInit));

  if (step.key === 'Enter' && element instanceof HTMLInputElement) {
    element.form?.requestSubmit();
  }

  await waitForRandomOperationDelay();
  logs.push(`Pressed "${step.key}" on "${step.selector}".`);
}

async function extractText(
  step: RemoteAutomationExtractTextStep,
  extracted: Record<string, string>,
  logs: string[],
): Promise<void> {
  const element = await waitForElement(
    {
      type: 'waitForSelector',
      selector: step.selector,
      timeoutMs: step.timeoutMs,
      visible: false,
    },
    logs,
  );

  const value =
    step.trim === false
      ? element.textContent ?? ''
      : (element.textContent ?? '').trim();

  extracted[step.key] = value;
  logs.push(`Extracted text from "${step.selector}" into "${step.key}".`);
}

async function extractAttribute(
  step: RemoteAutomationExtractAttributeStep,
  extracted: Record<string, string>,
  logs: string[],
): Promise<void> {
  const element = await waitForElement(
    {
      type: 'waitForSelector',
      selector: step.selector,
      timeoutMs: step.timeoutMs,
      visible: false,
    },
    logs,
  );

  extracted[step.key] = element.getAttribute(step.attribute) ?? '';
  logs.push(
    `Extracted attribute "${step.attribute}" from "${step.selector}" into "${step.key}".`,
  );
}
