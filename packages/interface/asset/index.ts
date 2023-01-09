export interface Asset {
  _id?: any;
  name: string;
  description: string;
  resources: Resource[];
  status: Status;
  configs: Config[];
  failure_message?: string;
  url: string;
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
  insert(resource: Resource): Promise<any>;
  update(resource: Resource): Promise<any>;
  delete(resource: Resource): Promise<any>;
}

export type Exporter = (_id: string) => Promise<void>;

export interface ExportMeta {
  name: string;
  description: string;
  resources: {[_module: string]: string[]};
  configs: Config[];
}

export type ResourceLister = () => Promise<{_id: string; title: string}[]>;
