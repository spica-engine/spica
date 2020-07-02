export interface Policy {
  _id: string;
  name: string;
  description?: string;
  statement: Statement[];
}

export interface Statement {
  effect: "allow" | "deny";
  action: string | string[];
  resource: string | string[];
  service: string;
}

export interface Service {
  $resource: string;
  $format?: string;
  title: string;
  actions: string[];
}

export interface PrepareUser {
  (request: any): any;
}

export interface LastState {
  alloweds: string[];
  denieds: string[];
}
