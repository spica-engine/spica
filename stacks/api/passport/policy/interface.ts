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
}

export interface Service {
  $resource: string;
  $format?: string;
  title: string;
  actions: string[];
}
