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

export interface Resource {
  _id: ObjectId;
  module: string;
  contents: {
    [key: string]: object;
  };
}
