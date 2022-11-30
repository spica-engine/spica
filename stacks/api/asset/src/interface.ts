import {ObjectId} from "@spica-server/database";

export interface Asset {
  _id?: ObjectId;
  name: string;
  description: string;
  resources: Resource[];
  status: Status;
  configs: Configuration[];
  failure_message?: string;
}

// use enum instead
export type Status = "downloaded" | "installed" | "failed";

export interface Configuration {
  module: string;
  resource_id: string;
  submodule: string;
  property: string;
  value: unknown;
}

export interface Resource<C = object> {
  _id: ObjectId | string;
  module: string;
  contents: C;
}

export type Validator = (resource: Resource) => Promise<void>;

export interface Operator {
  insert(resource: Resource): Promise<any>;
  update(resource: Resource): Promise<any>;
  delete(resource: Resource): Promise<any>;
}
