import type {
  PddPublishProductPayload,
  RemoteAutomationTask,
} from '@/utils/remoteAutomation';

export function createSmokeDemoTask(): RemoteAutomationTask {
  return {
    id: `demo-${Date.now()}`,
    title: 'Example Domain smoke test',
    url: 'https://example.com/',
    closeTabOnFinish: true,
    steps: [
      {
        type: 'waitForSelector',
        selector: 'h1',
        timeoutMs: 10_000,
      },
      {
        type: 'extractText',
        selector: 'h1',
        key: 'headline',
      },
    ],
    metadata: {
      source: 'demo',
    },
  };
}

export function createPddPublishDemoTask(
  payload: PddPublishProductPayload,
): RemoteAutomationTask {
  return {
    id: `pdd-demo-${Date.now()}`,
    title: 'PDD publish product demo',
    mode: 'pddPublishProduct',
    url: 'https://mms.pinduoduo.com/goods/category',
    closeTabOnFinish: false,
    waitForPageMs: 30_000,
    pddPublish: payload,
    metadata: {
      source: 'popup-demo',
      channel: 'pdd',
    },
  };
}
