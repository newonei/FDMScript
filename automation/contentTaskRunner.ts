import type {
  RemoteAutomationExecutionMessage,
  RemoteAutomationExecutionResult,
  RemoteAutomationTask,
} from '@/utils/remoteAutomation';
import { runPddPublishTask } from '@/automation/platforms/pdd/publishTaskRunner';
import { runGenericAutomationTask } from '@/automation/shared/genericTaskRunner';

export function isExecutionMessage(
  message: unknown,
): message is RemoteAutomationExecutionMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'scope' in message &&
    message.scope === 'remoteAutomation' &&
    'type' in message &&
    message.type === 'runTask' &&
    'task' in message
  );
}

export async function runAutomationTask(
  task: RemoteAutomationTask,
): Promise<RemoteAutomationExecutionResult> {
  if (task.mode === 'pddPublishProduct') {
    return runPddPublishTask(task);
  }

  return runGenericAutomationTask(task);
}
