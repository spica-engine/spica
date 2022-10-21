import {ObjectId} from "@spica-server/database";

export interface Asset {
  name: string;
  description: string;
  resources: Resource[];
  status: Status;
  configurations: Configuration[];
}

export type Status = "ready" | "pending_configuration";

export interface Configuration {
  name: string;

  module: string;
  file: string;

  type: string;
  key: string;
  value: any;

  configured: boolean;
}

export interface Resource<C = object> {
  _id: ObjectId;
  module: string;
  contents: C;
}

export type Validator = (resource: Resource) => Promise<void>;

export interface Operator {
  insert(resource: Resource): Promise<any>;
  update(previous: Resource, current: Resource): Promise<any>;
  delete(resource: Resource): Promise<any>;
}
