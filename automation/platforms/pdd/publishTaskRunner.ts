import type {
  PddPublishProductPayload,
  PddPublishSkuRow,
  RemoteAutomationBackgroundRequest,
  RemoteAutomationBackgroundResponse,
  RemoteAutomationExecutionResult,
  RemoteAutomationTask,
} from '@/utils/remoteAutomation';
import {
  activateInputElement,
  clickHTMLElement,
  delay,
  findButtonByText,
  isElementVisible,
  normalizeText,
  setElementValue,
  toErrorMessage,
  waitForCondition,
  waitForDocumentReady,
  waitForElement,
  waitForListboxOption,
  waitForRandomOperationDelay,
} from '@/automation/shared/dom';
import {
  PDD_CAROUSEL_UPLOAD_SELECTOR,
  PDD_CATEGORY_PANEL_SELECTOR,
  PDD_CATEGORY_SEARCH_INPUT_SELECTOR,
  PDD_CONFIRM_PUBLISH_BUTTON_SELECTOR,
  PDD_DETAIL_UPLOAD_SELECTOR,
  PDD_LOADING_TEXT,
  PDD_SKU_TABLE_BODY_SELECTOR,
  PDD_SPEC_ROOT_SELECTOR,
  PDD_SPEC_TYPE_HEADER_SELECTOR,
  PDD_SPEC_TYPE_ARROW_DOWN_SELECTOR,
  PDD_SPEC_TYPE_ARROW_UP_SELECTOR,
  PDD_SPEC_ROW_BOX_SELECTOR,
  PDD_SPEC_TYPE_DROPDOWN_SELECTOR,
  PDD_SPEC_TYPE_INPUT_SELECTOR,
  PDD_SPEC_TYPE_ROW_SELECTOR,
  PDD_SPEC_TYPE_SELECT_SELECTOR,
  PDD_SPEC_TYPE_SUFFIX_SELECTOR,
  PDD_SPEC_VALUE_INPUT_SELECTOR,
  PDD_TITLE_INPUT_SELECTOR,
  PDD_VIDEO_CROP_CONFIRM_BUTTON_SELECTOR,
  PDD_VIDEO_CROP_MODAL_SELECTOR,
  PDD_VIDEO_UPLOAD_SELECTOR,
} from '@/automation/platforms/pdd/constants';
import { PddProgressOverlay } from '@/automation/platforms/pdd/progressOverlay';

type ParsedSkuRow = {
  row: HTMLTableRowElement;
  rowIndex: number;
  specs: string[];
};

export async function runPddPublishTask(
  task: RemoteAutomationTask,
): Promise<RemoteAutomationExecutionResult> {
  const payload = task.pddPublish;
  const extracted: Record<string, string> = {};
  const logs: string[] = [`Started PDD publish task ${task.id}.`];
  let completedSteps = 0;
  let progressOverlay: PddProgressOverlay | null = null;

  try {
    if (!payload) {
      throw new Error('The PDD publish payload is missing.');
    }

    progressOverlay = new PddProgressOverlay();
    progressOverlay.startStep(
      'init',
      '正在初始化数据...',
      8,
      '准备启动拼多多商品发布流程',
    );
    await waitForDocumentReady();
    progressOverlay.completeStep('init', '初始化完成', 14, '页面已经准备就绪');

    progressOverlay.startStep(
      'category',
      '正在选择商品类目...',
      20,
      payload.categorySelectionText ?? payload.categoryKeyword,
    );
    await searchAndSelectPddCategory(payload, logs, progressOverlay);
    completedSteps = 1;

    await clickConfirmPublish(logs, progressOverlay);
    progressOverlay.completeStep('category', '类目选择完成', 32, '已经进入基础信息页面');
    completedSteps = 2;

    await fillPddBasicInfo(payload, logs, progressOverlay);
    completedSteps = 3;

    progressOverlay.startStep(
      'sku',
      '正在配置规格和SKU...',
      78,
      `共 ${payload.skuRows.length} 条 SKU 需要填写`,
    );
    await configurePddSpecs(payload, logs, progressOverlay);
    completedSteps = 4;

    await fillPddSkuTable(payload, logs, progressOverlay);
    progressOverlay.completeStep(
      'sku',
      'SKU 属性填写完成',
      100,
      `已完成 ${payload.skuRows.length} 条 SKU 的价格、库存和预览图设置`,
    );
    progressOverlay.finishSuccess(
      '飞德慕AI工具操作完成',
      '当前基础信息填写流程已经执行完成。',
    );
    completedSteps = 5;

    extracted.productTitle = payload.title;
    extracted.categoryKeyword = payload.categoryKeyword;
    extracted.specSummary = payload.specs
      .map((spec) => `${spec.name}:${spec.values.join('|')}`)
      .join('; ');

    logs.push('PDD publish form completed successfully.');

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
    logs.push(`PDD publish task failed: ${message}`);
    progressOverlay?.failCurrent(message);

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

async function searchAndSelectPddCategory(
  payload: PddPublishProductPayload,
  logs: string[],
  progressOverlay?: PddProgressOverlay,
): Promise<void> {
  const searchInput = (await waitForElement(
    {
      type: 'waitForSelector',
      selector: PDD_CATEGORY_SEARCH_INPUT_SELECTOR,
      timeoutMs: 20_000,
      visible: true,
    },
    logs,
  )) as HTMLInputElement;

  activateInputElement(searchInput);
  await waitForRandomOperationDelay();
  setElementValue(searchInput, payload.categoryKeyword);
  searchInput.dispatchEvent(
    new KeyboardEvent('keyup', {
      key: 'Enter',
      bubbles: true,
    }),
  );
  progressOverlay?.update(
    '正在搜索分类关键词...',
    22,
    payload.categoryKeyword,
  );
  logs.push(`Typed category keyword "${payload.categoryKeyword}".`);

  const panel = (await waitForElement(
    {
      type: 'waitForSelector',
      selector: PDD_CATEGORY_PANEL_SELECTOR,
      timeoutMs: 10_000,
      visible: true,
    },
    logs,
  )) as HTMLUListElement;

  const wantedText =
    payload.categorySelectionMode === 'exact'
      ? normalizeText(payload.categorySelectionText ?? payload.categoryKeyword)
      : null;

  const option = await waitForCondition(() => {
    const candidates = Array.from(panel.querySelectorAll<HTMLLIElement>('li'))
      .filter((item) => !normalizeText(item.textContent).includes('没有合适的类目'))
      .filter((item) => normalizeText(item.textContent).length > 0);

    if (!candidates.length) {
      return null;
    }

    if (!wantedText) {
      return candidates[0] ?? null;
    }

    return (
      candidates.find(
        (item) => normalizeText(item.textContent) === wantedText,
      ) ?? null
    );
  }, 10_000, 'Waiting for a matching PDD category option.');

  const selectedCategoryText = normalizeText(option.textContent);
  progressOverlay?.update(
    '正在选择匹配类目...',
    24,
    selectedCategoryText,
  );
  clickHTMLElement(option);
  await waitForRandomOperationDelay();
  logs.push(`Selected category option "${selectedCategoryText}".`);

  await waitForCondition(() => {
    const currentPanel = document.querySelector(PDD_CATEGORY_PANEL_SELECTOR);
    if (currentPanel && isElementVisible(currentPanel)) {
      return null;
    }

    const normalizedInputValue = normalizeText(searchInput.value);
    if (
      normalizedInputValue &&
      normalizedInputValue !== normalizeText(payload.categoryKeyword)
    ) {
      return true;
    }

    const confirmButton = document.querySelector<HTMLButtonElement>(
      PDD_CONFIRM_PUBLISH_BUTTON_SELECTOR,
    );
    return confirmButton && isPddConfirmButtonReady(confirmButton) ? true : null;
  }, 10_000, 'Waiting for the selected PDD category to settle.');

  await delay(700);
  progressOverlay?.update(
    '商品类目选择完成',
    28,
    selectedCategoryText,
  );
  logs.push(`Category selection "${selectedCategoryText}" has settled.`);
}

async function clickConfirmPublish(
  logs: string[],
  progressOverlay?: PddProgressOverlay,
): Promise<void> {
  const button = (await waitForElement(
    {
      type: 'waitForSelector',
      selector: PDD_CONFIRM_PUBLISH_BUTTON_SELECTOR,
      timeoutMs: 20_000,
      visible: true,
    },
    logs,
  )) as HTMLButtonElement;

  await waitForCondition(() => {
    const currentButton = document.querySelector<HTMLButtonElement>(
      PDD_CONFIRM_PUBLISH_BUTTON_SELECTOR,
    );
    return currentButton && isPddConfirmButtonReady(currentButton)
      ? currentButton
      : null;
  }, 10_000, 'Waiting for the publish confirmation button to be ready.');

  progressOverlay?.update(
    '正在进入基础信息页面...',
    30,
    '等待页面跳转和基础信息区域初始化',
  );
  clickHTMLElement(button);
  await waitForRandomOperationDelay();
  logs.push('Clicked the publish confirmation button.');

  await waitForPddLoadingToFinish(logs);

  try {
    await waitForElement(
      {
        type: 'waitForSelector',
        selector: PDD_TITLE_INPUT_SELECTOR,
        timeoutMs: 4_000,
        visible: true,
      },
      logs,
    );
  } catch {
    logs.push(
      'The publish form did not open on the first click, waiting briefly before retrying.',
    );
    await delay(900);
    progressOverlay?.update(
      '正在重试进入基础信息页面...',
      31,
      '第一次点击后页面还未完成跳转',
    );

    const retryButton = (await waitForElement(
      {
        type: 'waitForSelector',
        selector: PDD_CONFIRM_PUBLISH_BUTTON_SELECTOR,
        timeoutMs: 10_000,
        visible: true,
      },
      logs,
    )) as HTMLButtonElement;

    clickHTMLElement(retryButton);
    await waitForRandomOperationDelay();
    logs.push('Retried the publish confirmation button.');

    await waitForPddLoadingToFinish(logs);

    await waitForElement(
      {
        type: 'waitForSelector',
        selector: PDD_TITLE_INPUT_SELECTOR,
        timeoutMs: 30_000,
        visible: true,
      },
      logs,
    );
  }
}

async function fillPddBasicInfo(
  payload: PddPublishProductPayload,
  logs: string[],
  progressOverlay?: PddProgressOverlay,
): Promise<void> {
  await waitForElement(
    {
      type: 'waitForSelector',
      selector: PDD_TITLE_INPUT_SELECTOR,
      timeoutMs: 30_000,
      visible: true,
    },
    logs,
  );

  progressOverlay?.startStep(
    'images',
    '正在上传轮播图...',
    40,
    `共 ${payload.carouselImages.length} 张主图`,
  );

  await requestFileUpload(
    PDD_CAROUSEL_UPLOAD_SELECTOR,
    payload.carouselImages,
    logs,
  );

  if (payload.introVideoPath?.trim()) {
    progressOverlay?.update(
      '正在上传商品视频...',
      52,
      payload.introVideoPath.split(/[/\\]/).at(-1) ?? payload.introVideoPath,
    );
    await requestFileUpload(
      PDD_VIDEO_UPLOAD_SELECTOR,
      [payload.introVideoPath],
      logs,
    );
    await handleOptionalPddVideoCropDialog(logs, progressOverlay);
  }

  if (payload.detailImages?.length) {
    progressOverlay?.update(
      '正在上传详情图...',
      56,
      `共 ${payload.detailImages.length} 张详情图`,
    );
    await requestFileUpload(
      PDD_DETAIL_UPLOAD_SELECTOR,
      payload.detailImages,
      logs,
    );
  }

  progressOverlay?.completeStep(
    'images',
    '图片上传完成',
    64,
    `主图 ${payload.carouselImages.length} 张，详情图 ${payload.detailImages?.length ?? 0} 张`,
  );

  const titleInput = (await waitForElement(
    {
      type: 'waitForSelector',
      selector: PDD_TITLE_INPUT_SELECTOR,
      timeoutMs: 30_000,
      visible: true,
    },
    logs,
  )) as HTMLInputElement;

  progressOverlay?.startStep(
    'basic',
    '正在填写商品标题...',
    68,
    payload.title,
  );
  setElementValue(titleInput, payload.title);
  await waitForRandomOperationDelay();
  titleInput.blur();
  progressOverlay?.completeStep(
    'basic',
    '基本属性填写完成',
    74,
    payload.title,
  );
  logs.push(`Filled the product title: "${payload.title}".`);
}

async function configurePddSpecs(
  payload: PddPublishProductPayload,
  logs: string[],
  progressOverlay?: PddProgressOverlay,
): Promise<void> {
  const specRoot = (await waitForElement(
    {
      type: 'waitForSelector',
      selector: PDD_SPEC_ROOT_SELECTOR,
      timeoutMs: 30_000,
      visible: true,
    },
    logs,
  )) as HTMLElement;

  for (const [index, spec] of payload.specs.entries()) {
    progressOverlay?.update(
      `正在配置规格类型 ${index + 1}/${payload.specs.length}...`,
      80 + index * 4,
      `${spec.name}，${spec.values.length} 个规格值`,
    );
    const specRowBox = await addPddSpecType(specRoot, index, spec.name, logs);
    await fillPddSpecValues(specRowBox, spec.values, logs, progressOverlay);
  }
}

async function addPddSpecType(
  specRoot: HTMLElement,
  specIndex: number,
  specName: string,
  logs: string[],
): Promise<HTMLElement> {
  const beforeCount = getSpecTypeInputs(specRoot).length;
  const beforeRowCount = getSpecValueRowBoxes(specRoot).length;
  const addButton = findButtonByText(specRoot, '添加规格类型');

  if (!addButton) {
    throw new Error('Could not find the "添加规格类型" button.');
  }

  clickHTMLElement(addButton);
  logs.push(`Clicked the add spec type button for slot ${specIndex + 1}.`);
  await waitForRandomOperationDelay();

  const specTypeRow = await waitForCondition(() => {
    const rows = getSpecTypeRows(specRoot);
    const candidate = rows[specIndex] ?? rows.at(-1) ?? null;
    if (!candidate) {
      return null;
    }

    const input = candidate.querySelector<HTMLInputElement>(PDD_SPEC_TYPE_INPUT_SELECTOR);
    const selectRoot = candidate.querySelector<HTMLElement>(PDD_SPEC_TYPE_SELECT_SELECTOR);
    const header = candidate.querySelector<HTMLElement>(PDD_SPEC_TYPE_HEADER_SELECTOR);
    const arrowDown = candidate.querySelector(PDD_SPEC_TYPE_ARROW_DOWN_SELECTOR);
    const hasNewInput = getSpecTypeInputs(specRoot).length > beforeCount || specIndex < beforeCount;

    return hasNewInput &&
      input &&
      selectRoot &&
      header &&
      arrowDown &&
      isElementVisible(candidate) &&
      isElementVisible(selectRoot) &&
      isElementVisible(header)
      ? candidate
      : null;
  }, 12_000, `Waiting for spec type row ${specIndex + 1} to finish rendering.`);

  const typeInput = specTypeRow.querySelector<HTMLInputElement>(
    PDD_SPEC_TYPE_INPUT_SELECTOR,
  );

  if (!typeInput) {
    throw new Error(`Could not find the spec type input ${specIndex + 1}.`);
  }

  await waitForRandomOperationDelay();
  await openPddSpecTypeDropdown(specTypeRow, typeInput, logs);

  const option = await waitForListboxOption(specName);
  clickHTMLElement(option);
  await waitForRandomOperationDelay();

  await waitForCondition(() => {
    const currentInput = specTypeRow.querySelector<HTMLInputElement>(
      PDD_SPEC_TYPE_INPUT_SELECTOR,
    );
    return currentInput && normalizeText(currentInput.value) === normalizeText(specName)
      ? true
      : null;
  }, 10_000, `Waiting for the spec type "${specName}" to be selected.`);

  const specRowBox = await waitForCondition(() => {
    const rowBoxes = getSpecValueRowBoxes(specRoot);
    if (rowBoxes.length <= beforeRowCount) {
      return null;
    }

    const candidate = rowBoxes[specIndex] ?? rowBoxes.at(-1) ?? null;
    return candidate && isElementVisible(candidate) ? candidate : null;
  }, 10_000, `Waiting for spec row container ${specIndex + 1}.`);

  logs.push(`Selected spec type "${specName}".`);
  return specRowBox;
}

async function fillPddSpecValues(
  specRowBox: HTMLElement,
  values: string[],
  logs: string[],
  progressOverlay?: PddProgressOverlay,
): Promise<void> {
  for (const [index, value] of values.entries()) {
    progressOverlay?.update(
      `正在填写规格值 ${index + 1}/${values.length}...`,
      84 + Math.round(((index + 1) / Math.max(values.length, 1)) * 4),
      value,
    );
    const input = await waitForCondition(() => {
      const candidates = getVisibleSpecValueInputs(specRowBox);
      return (
        candidates[index] ??
        candidates.find((element) => element.value.trim() === '') ??
        null
      );
    }, 10_000, `Waiting for the spec value input for "${value}".`);

    await fillPddSpecValueInput(input, value);

    await waitForCondition(
      () => (normalizeText(input.value) === normalizeText(value) ? true : null),
      5_000,
      `Waiting for the spec value "${value}" to be committed.`,
    );

    logs.push(`Filled spec value "${value}".`);

    if (index < values.length - 1) {
      await waitForCondition(() => {
        const candidates = getVisibleSpecValueInputs(specRowBox);
        const nextInput = candidates[index + 1] ?? null;
        return nextInput && nextInput.value.trim() === '' ? nextInput : null;
      }, 10_000, `Waiting for the next spec value input after "${value}".`);
    }

    await waitForRandomOperationDelay();
  }
}

async function fillPddSkuTable(
  payload: PddPublishProductPayload,
  logs: string[],
  progressOverlay?: PddProgressOverlay,
): Promise<void> {
  const tbody = (await waitForElement(
    {
      type: 'waitForSelector',
      selector: PDD_SKU_TABLE_BODY_SELECTOR,
      timeoutMs: 30_000,
      visible: true,
    },
    logs,
  )) as HTMLTableSectionElement;

  const parsedRows = parsePddSkuTableRows(tbody, payload.specs.length);

  for (const [index, skuRow] of payload.skuRows.entries()) {
    progressOverlay?.update(
      `正在填写SKU ${index + 1}/${payload.skuRows.length}...`,
      88 + Math.round(((index + 1) / Math.max(payload.skuRows.length, 1)) * 10),
      skuRow.specs.join(' / '),
    );
    const parsedRow = parsedRows.find((row) =>
      row.specs.every(
        (specValue, rowSpecIndex) =>
          normalizeText(specValue) === normalizeText(skuRow.specs[rowSpecIndex]),
      ),
    );

    if (!parsedRow) {
      throw new Error(
        `Could not find the SKU row for specs: ${skuRow.specs.join(' / ')}`,
      );
    }

    await fillSinglePddSkuRow(parsedRow, skuRow, logs);
  }
}

async function fillSinglePddSkuRow(
  parsedRow: ParsedSkuRow,
  skuRow: PddPublishSkuRow,
  logs: string[],
): Promise<void> {
  const stockInput = parsedRow.row.querySelector<HTMLInputElement>(
    'td.sku-input.quantity input[data-testid="beast-core-input-htmlInput"]',
  );
  const priceInputs = Array.from(
    parsedRow.row.querySelectorAll<HTMLInputElement>(
      'input[data-testid="beast-core-inputNumber-htmlInput"]',
    ),
  );
  const codeInput = parsedRow.row.querySelector<HTMLInputElement>(
    'td.sku-input:not(.quantity) input[data-testid="beast-core-input-htmlInput"]',
  );

  if (!stockInput) {
    throw new Error(`Missing stock input for SKU ${skuRow.specs.join(' / ')}.`);
  }

  if (priceInputs.length < 2) {
    throw new Error(
      `Missing price inputs for SKU ${skuRow.specs.join(' / ')}.`,
    );
  }

  setElementValue(stockInput, String(skuRow.stock));
  await waitForRandomOperationDelay();
  setElementValue(priceInputs[0], String(skuRow.groupPrice));
  await waitForRandomOperationDelay();
  setElementValue(priceInputs[1], String(skuRow.singlePrice));
  await waitForRandomOperationDelay();

  if (skuRow.skuCode && codeInput) {
    setElementValue(codeInput, skuRow.skuCode);
    await waitForRandomOperationDelay();
  }

  if (skuRow.previewImage) {
    const previewSelector = `${PDD_SKU_TABLE_BODY_SELECTOR} > tr:nth-of-type(${parsedRow.rowIndex + 1}) td.sku-preview-cell input[type="file"]`;
    await requestFileUpload(previewSelector, [skuRow.previewImage], logs);
  }

  if (typeof skuRow.enabled === 'boolean') {
    const switchElement = parsedRow.row.querySelector<HTMLElement>(
      '[data-testid="beast-core-switch"]',
    );

    if (switchElement) {
      const isActive = switchElement.className.includes('active');
      if (isActive !== skuRow.enabled) {
        clickHTMLElement(switchElement);
        await waitForRandomOperationDelay();
      }
    }
  }

  logs.push(`Filled SKU row "${skuRow.specs.join(' / ')}".`);
}

function parsePddSkuTableRows(
  tbody: HTMLTableSectionElement,
  specColumnCount: number,
): ParsedSkuRow[] {
  const rows = Array.from(tbody.querySelectorAll<HTMLTableRowElement>('tr'));
  const parsedRows: ParsedSkuRow[] = [];
  let currentPrimarySpec = '';

  rows.forEach((row, rowIndex) => {
    const titles = Array.from(
      row.querySelectorAll<HTMLElement>('.sku-row-title'),
    ).map((element) => normalizeText(element.textContent));

    if (specColumnCount === 1) {
      if (!titles[0]) {
        throw new Error(`Could not parse the spec title for SKU row ${rowIndex + 1}.`);
      }

      parsedRows.push({
        row,
        rowIndex,
        specs: [titles[0]],
      });
      return;
    }

    if (titles.length >= 2) {
      currentPrimarySpec = titles[0];
      parsedRows.push({
        row,
        rowIndex,
        specs: [titles[0], titles[1]],
      });
      return;
    }

    if (titles.length === 1 && currentPrimarySpec) {
      parsedRows.push({
        row,
        rowIndex,
        specs: [currentPrimarySpec, titles[0]],
      });
      return;
    }

    throw new Error(`Could not map the spec columns for SKU row ${rowIndex + 1}.`);
  });

  return parsedRows;
}

async function requestFileUpload(
  selector: string,
  files: string[],
  logs: string[],
): Promise<void> {
  if (!files.length) {
    return;
  }

  const input = (await waitForElement(
    {
      type: 'waitForSelector',
      selector,
      timeoutMs: 20_000,
      visible: false,
    },
    logs,
  )) as HTMLInputElement;

  const response = await sendBackgroundRequest({
    scope: 'remoteAutomation',
    type: 'setInputFiles',
    selector,
    files,
  });

  if (!response.ok) {
    throw new Error(response.message);
  }

  await delay(180);

  const liveInput =
    Array.from(document.querySelectorAll<HTMLInputElement>(selector)).find(
      (candidate) => candidate.isConnected,
    ) ?? input;

  if (liveInput !== input) {
    logs.push(`Upload input "${selector}" was re-mounted after file selection.`);
  }

  liveInput.dispatchEvent(
    new Event('change', {
      bubbles: true,
      composed: true,
    }),
  );
  logs.push(`Uploaded ${files.length} local file(s) through "${selector}".`);
  await waitForRandomOperationDelay({
    minMs: Math.max(1_000, files.length * 280),
    maxMs: Math.max(1_800, files.length * 420),
  });
}

async function handleOptionalPddVideoCropDialog(
  logs: string[],
  progressOverlay?: PddProgressOverlay,
): Promise<void> {
  let confirmButton: HTMLButtonElement | null = null;

  try {
    confirmButton = await waitForCondition(() => {
      const modal = getVisiblePddVideoCropModal();
      if (!modal) {
        return null;
      }

      const button =
        modal.querySelector<HTMLButtonElement>(
          PDD_VIDEO_CROP_CONFIRM_BUTTON_SELECTOR,
        ) ??
        (findButtonByText(modal, '确认') as HTMLButtonElement | null);

      return button && isElementVisible(button) ? button : null;
    }, 8_000, 'Waiting for the optional PDD video crop dialog.');
  } catch {
    logs.push('No video crop dialog appeared after the video upload.');
    return;
  }

  progressOverlay?.update('正在确认视频裁剪...', 54, '检测到视频裁剪弹窗');
  clickHTMLElement(confirmButton);
  await waitForRandomOperationDelay();

  await waitForCondition(
    () => (getVisiblePddVideoCropModal() ? null : true),
    15_000,
    'Waiting for the PDD video crop dialog to close.',
  );
  logs.push('Confirmed the PDD video crop dialog.');
}

async function sendBackgroundRequest(
  message: RemoteAutomationBackgroundRequest,
): Promise<RemoteAutomationBackgroundResponse> {
  return (await browser.runtime.sendMessage(
    message,
  )) as RemoteAutomationBackgroundResponse;
}

function getSpecTypeInputs(root: ParentNode): HTMLInputElement[] {
  return Array.from(
    root.querySelectorAll<HTMLInputElement>(PDD_SPEC_TYPE_INPUT_SELECTOR),
  );
}

function getSpecTypeRows(root: ParentNode): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(PDD_SPEC_TYPE_ROW_SELECTOR),
  ).filter((row) => isElementVisible(row));
}

function getSpecValueRowBoxes(root: ParentNode): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(PDD_SPEC_ROW_BOX_SELECTOR),
  ).filter((row) => isElementVisible(row));
}

function getVisibleSpecValueInputs(root: ParentNode): HTMLInputElement[] {
  return Array.from(
    root.querySelectorAll<HTMLInputElement>(PDD_SPEC_VALUE_INPUT_SELECTOR),
  ).filter((input) => isElementVisible(input));
}

function getVisiblePddVideoCropModal(): HTMLElement | null {
  return (
    Array.from(
      document.querySelectorAll<HTMLElement>(PDD_VIDEO_CROP_MODAL_SELECTOR),
    ).find(
      (modal) =>
        isElementVisible(modal) &&
        normalizeText(modal.textContent).includes('裁剪视频'),
    ) ?? null
  );
}

async function fillPddSpecValueInput(
  input: HTMLInputElement,
  value: string,
): Promise<void> {
  const trigger =
    (input.closest('[data-testid="beast-core-input"]') as HTMLElement | null) ??
    input;

  dispatchPointerClickSequence(trigger);
  activateInputElement(input);
  await waitForRandomOperationDelay();
  input.focus({ preventScroll: true });

  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;

  valueSetter?.call(input, '');
  input.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      composed: true,
      data: '',
      inputType: 'deleteContentBackward',
    }),
  );

  let currentValue = '';
  for (const character of value) {
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: character,
        bubbles: true,
        cancelable: true,
      }),
    );
    currentValue += character;
    valueSetter?.call(input, currentValue);
    input.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        composed: true,
        data: character,
        inputType: 'insertText',
      }),
    );
    input.dispatchEvent(
      new KeyboardEvent('keyup', {
        key: character,
        bubbles: true,
        cancelable: true,
      }),
    );
    await delay(60);
  }

  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    }),
  );
  input.dispatchEvent(
    new KeyboardEvent('keypress', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    }),
  );
  input.dispatchEvent(
    new KeyboardEvent('keyup', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    }),
  );
  await waitForRandomOperationDelay();
  input.blur();
}

async function openPddSpecTypeDropdown(
  specTypeRow: HTMLElement,
  typeInput: HTMLInputElement,
  logs: string[],
): Promise<void> {
  const arrowIcon = await waitForCondition(() => {
    const icon =
      specTypeRow.querySelector(PDD_SPEC_TYPE_ARROW_DOWN_SELECTOR) ??
      specTypeRow.querySelector(PDD_SPEC_TYPE_ARROW_UP_SELECTOR);
    return icon && isElementVisible(icon) ? icon : null;
  }, 10_000, 'Waiting for the spec type arrow icon to appear.');

  const selectRoot = specTypeRow.querySelector<HTMLElement>(PDD_SPEC_TYPE_SELECT_SELECTOR);
  const selectHeader = specTypeRow.querySelector<HTMLElement>(PDD_SPEC_TYPE_HEADER_SELECTOR);
  const suffix = specTypeRow.querySelector<HTMLElement>(PDD_SPEC_TYPE_SUFFIX_SELECTOR);

  const triggerCandidates = [
    arrowIcon.closest('span'),
    suffix,
    arrowIcon.parentElement,
    arrowIcon,
    selectHeader,
    selectRoot,
    typeInput.closest('.IPT_inputWrapper_5-178-0'),
    typeInput.closest('.ST_inputWrapper_5-178-0'),
    typeInput.closest('[data-testid="beast-core-input"]'),
    typeInput.parentElement,
    typeInput,
  ].filter((element): element is Element => Boolean(element));

  for (const candidate of triggerCandidates) {
    await waitForCondition(
      () => {
        if (candidate instanceof HTMLElement) {
          return isElementVisible(candidate) ? true : null;
        }

        return true;
      },
      2_000,
      'Waiting for the spec type trigger to become visible.',
    );

    dispatchPointerClickSequence(candidate);
    await waitForRandomOperationDelay();
    activateInputElement(typeInput);
    sendDropdownHotkeys(typeInput);

    try {
      await waitForCondition(() => {
        const dropdown = document.querySelector(PDD_SPEC_TYPE_DROPDOWN_SELECTOR);
        if (dropdown && isElementVisible(dropdown)) {
          return true;
        }

        const expandedArrow = specTypeRow.querySelector(PDD_SPEC_TYPE_ARROW_UP_SELECTOR);
        return expandedArrow && isElementVisible(expandedArrow) ? true : null;
      }, 2_500, 'Waiting for the PDD spec type dropdown to appear.');
      logs.push('Opened the spec type dropdown.');
      return;
    } catch {
      await waitForRandomOperationDelay();
    }
  }

  throw new Error('Could not open the PDD spec type dropdown.');
}

function sendDropdownHotkeys(typeInput: HTMLInputElement): void {
  typeInput.focus({ preventScroll: true });
  typeInput.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    }),
  );
  typeInput.dispatchEvent(
    new KeyboardEvent('keyup', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    }),
  );
  typeInput.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    }),
  );
  typeInput.dispatchEvent(
    new KeyboardEvent('keyup', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    }),
  );
}

function dispatchPointerClickSequence(element: Element): void {
  if (element instanceof HTMLElement) {
    element.scrollIntoView({
      block: 'center',
      inline: 'nearest',
      behavior: 'auto',
    });
  }

  const mouseEventInit: MouseEventInit = {
    bubbles: true,
    composed: true,
    cancelable: true,
    button: 0,
  };

  const pointerEventInit: PointerEventInit = {
    bubbles: true,
    composed: true,
    cancelable: true,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
  };

  element.dispatchEvent(new PointerEvent('pointerdown', pointerEventInit));
  element.dispatchEvent(new MouseEvent('mousedown', mouseEventInit));
  element.dispatchEvent(new PointerEvent('pointerup', pointerEventInit));
  element.dispatchEvent(new MouseEvent('mouseup', mouseEventInit));
  element.dispatchEvent(new MouseEvent('click', mouseEventInit));
  if ('click' in element && typeof element.click === 'function') {
    element.click();
  }
}

function isPddConfirmButtonReady(button: HTMLButtonElement): boolean {
  return (
    !button.disabled &&
    button.getAttribute('aria-disabled') !== 'true' &&
    !/\bdisabled\b/i.test(button.className)
  );
}

async function waitForPddLoadingToFinish(logs: string[]): Promise<void> {
  let hasSeenLoading = hasVisiblePddLoadingText();

  if (!hasSeenLoading) {
    try {
      await waitForCondition(
        () => (hasVisiblePddLoadingText() ? true : null),
        5_000,
        'Waiting for the PDD loading indicator to appear.',
      );
      hasSeenLoading = true;
    } catch {
      return;
    }
  }

  if (hasSeenLoading) {
    logs.push('Detected the PDD loading indicator.');
  }

  await waitForCondition(
    () => (hasVisiblePddLoadingText() ? null : true),
    30_000,
    'Waiting for the PDD loading indicator to disappear.',
  );
  logs.push('The PDD loading indicator disappeared.');
}

function hasVisiblePddLoadingText(): boolean {
  const pageText = normalizeText(document.body?.innerText);
  return pageText.includes(PDD_LOADING_TEXT);
}
