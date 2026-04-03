export type RemoteAutomationTrigger =
  | 'bootstrap'
  | 'install'
  | 'startup'
  | 'alarm'
  | 'manual';

export type MessageSenderLike = {
  tab?: {
    id?: number;
  };
};

export type DebuggeeTarget = {
  tabId: number;
};
