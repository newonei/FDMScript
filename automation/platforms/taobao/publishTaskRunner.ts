import type {
  RemoteAutomationExecutionResult,
  RemoteAutomationTask,
} from '@/utils/remoteAutomation';

export async function runTaobaoPublishTask(
  task: RemoteAutomationTask,
): Promise<RemoteAutomationExecutionResult> {
  return {
    ok: false,
    pageUrl: task.url,
    pageTitle: task.title ?? 'Taobao publish',
    extracted: {},
    logs: ['Taobao publish automation has not been implemented yet.'],
    completedSteps: 0,
    error: 'Taobao publish automation has not been implemented yet.',
  };
}
