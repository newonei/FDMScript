import type { RemoteAutomationBackgroundRequest } from '@/utils/remoteAutomation';

export function buildUrl(serverBaseUrl: string, path: string): string {
  const baseUrl = serverBaseUrl.endsWith('/')
    ? serverBaseUrl
    : `${serverBaseUrl}/`;

  return new URL(path.replace(/^\/+/, ''), baseUrl).toString();
}

export function shouldRegisterDevice(lastRegistrationAt: string | null): boolean {
  if (!lastRegistrationAt) {
    return true;
  }

  const lastRegisteredTime = new Date(lastRegistrationAt).getTime();
  return Number.isNaN(lastRegisteredTime)
    ? true
    : Date.now() - lastRegisteredTime > 60 * 60 * 1000;
}

export function isRemoteAutomationRequest(
  message: unknown,
): message is RemoteAutomationBackgroundRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    'scope' in message &&
    message.scope === 'remoteAutomation' &&
    'type' in message
  );
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
