export interface DatabaseOptions {
  collection: string;
  type: "INSERT" | "UPDATE" | "REPLACE" | "DELETE";
}

export interface Description {
  name: string;
  icon: string;
  title: string;
  description?: string;
}

export interface FirehoseOptions {
  event: "*" | "**" | "connection" | "close" | string;
}

// We can't use integer enum because we show these values on the UI.
export enum HttpMethod {
  All = "All",
  Get = "Get",
  Post = "Post",
  Put = "Put",
  Delete = "Delete",
  Options = "Options",
  Patch = "Patch",
  Head = "Head"
}

export interface HttpOptions {
  method: HttpMethod;
  path: string;
  preflight: boolean;
}

export interface ScheduleOptions {
  frequency: string;
  timezone: string;
}

export interface EventOptions {
  name: "READY";
}
