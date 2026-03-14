export interface ProfilerEntry {
  op: Op;
  ns: string;
  command: DynamicObject;
  keysExamined: number;
  docsExamined: number;
  numYield: number;
  locks: DynamicObject;
  millis: number;
  planSummary: string;
  ts: Date;
  client: string;
  appName: string;
  allUsers: Array<DynamicObject>;
  user: string;
}

type DynamicObject = {
  [key: string]: any;
};

type Op =
  | "command"
  | "count"
  | "distinct"
  | "geoNear"
  | "getMore"
  | "group"
  | "insert"
  | "mapReduce"
  | "query"
  | "remove"
  | "update";
