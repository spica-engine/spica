export interface Statement {
  service: string;
  action: string;
  resource:
    | string
    | string[]
    | {
        include: string;
        exclude: string[];
      };
  module: string;
}
export const EMPTY_STATEMENT: Statement = {
  service: undefined,
  module: undefined,
  action: undefined,
  resource: undefined
};
