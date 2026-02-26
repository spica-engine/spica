export type Commit = {
  title: string;
  hash: string;
  author: string;
  relativeTime: string;
};

export type TerminalLineVariant = 'command' | 'output' | 'error';

export type TerminalLineEntry = {
  id: string;
  text: string;
  variant: TerminalLineVariant;
};
