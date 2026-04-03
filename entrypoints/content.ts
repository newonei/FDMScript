import { runAutomationTask, isExecutionMessage } from '@/automation/contentTaskRunner';
import { mountFloatingWorkbench } from '@/utils/floatingWorkbench';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_idle',
  main() {
    mountFloatingWorkbench();

    browser.runtime.onMessage.addListener((message: unknown) => {
      if (!isExecutionMessage(message)) {
        return undefined;
      }

      return runAutomationTask(message.task);
    });
  },
});
