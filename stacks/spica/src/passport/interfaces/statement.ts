export interface Statement {
  service: string;
  effect: "allow" | "deny";
  action: string[] | string;
  resource: string[];
}

export const EMPTY_STATEMENT: Statement = {
  service: undefined,
  effect: undefined,
  action: undefined,
  resource: []
};
