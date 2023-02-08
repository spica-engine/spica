export interface Asset {
  _id?: any;
  name: string;
  description: string;
  resources: Resource[];
  status: Status;
  configs: Config[];
  failure_message?: string;
  url: string;
  icon: string;
}

export type Status = "downloaded" | "installed" | "failed";

export interface Config {
  title: string;
  module: string;
  resource_id: string;
  submodule: string;
  property: string;
  value?: unknown;
  type: string;
}

export interface Resource<C = object> {
  _id: any;
  module: string;
  contents: C;
}

export type Validator = (resource: Resource) => Promise<void>;

export interface Operator {
  insert(resource: Resource): Promise<Command[]>;
  update(resource: Resource): Promise<Command[]>;
  delete(resource: Resource): Promise<Command[]>;
}

export type Exporter = (_id: string) => Promise<void>;

export interface ExportMeta {
  name: string;
  description: string;
  resources: {[_module: string]: string[]};
  configs: Config[];
}

export type ResourceLister = () => Promise<{_id: string; title: string}[]>;

export interface Command {
  title: string;
  execute: () => Promise<any>;
  undo: () => Promise<any>;
}

export interface CommandWithId extends Command {
  id: number;
}
