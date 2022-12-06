export interface Asset {
  _id?: string;
  name: string;
  description: string;
  resources: Resource[];
  status: Status;
  configs: Configuration[];
  failure_message?: string;
}

export type Status = "downloaded" | "installed" | "failed";

export interface Configuration {
  module: string;
  resource_id: string;
  submodule: string;
  property: string;
  value: unknown;
}

export interface Resource<C = object> {
  _id: string;
  module: string;
  contents: C;
}

export interface InstallationPreview {
  insertions: Resource[];
  updations: Resource[];
  deletions: Resource[];
}

export interface InstallationPreviewByModules {
  [module: string]: {
    insertions: Resource[];
    updations: Resource[];
    deletions: Resource[];
  };
}
