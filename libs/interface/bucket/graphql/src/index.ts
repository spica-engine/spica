import {BucketDocument} from "@spica-server/interface/bucket/services";

export interface FindResponse {
  meta: {total: number};
  data: BucketDocument[];
}

export enum Prefix {
  Type = "type",
  Input = "input"
}

export enum Suffix {
  Type = "",
  Input = "Input"
}

export interface SchemaWarning {
  target: string;
  reason: string;
}
