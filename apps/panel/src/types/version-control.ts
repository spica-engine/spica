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

export type ChangeStatus = 'A' | 'M' | 'D';

export type DiffEntry = {
  filePath: string;
  moduleType: string;
  entityId: string;
  fileStatus: ChangeStatus;
};

export type EntityChange = {
  id: string;
  label: string;
  status: ChangeStatus;
};

export type ModuleGroup = {
  moduleType: string;
  items: EntityChange[];
};

export type ParsedDiff = {
  modules: ModuleGroup[];
};
