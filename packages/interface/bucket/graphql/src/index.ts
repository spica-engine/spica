import {BucketDocument} from "@spica-server/interface/bucket";

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
