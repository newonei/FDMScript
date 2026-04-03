import type {
  RemoteAutomationBackgroundResponse,
  RemoteAutomationTaskResult,
  RemoteAutomationUploadDiagnostics,
} from '@/utils/remoteAutomation';
import { getRemoteAutomationStore } from '@/utils/remoteAutomation';

export async function buildBackgroundResponse(
  ok: boolean,
  message: string,
  result?: RemoteAutomationTaskResult,
  uploadDiagnostics?: RemoteAutomationUploadDiagnostics,
): Promise<RemoteAutomationBackgroundResponse> {
  return {
    ok,
    message,
    store: await getRemoteAutomationStore(),
    result,
    uploadDiagnostics,
  };
}
