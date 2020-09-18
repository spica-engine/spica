export interface Statement {
  action: string;
  resource:
    | string[]
    | {
        include: string;
        exclude: string[];
      };
  module: string;
}
export const EMPTY_STATEMENT: Statement = {
  module: undefined,
  action: undefined,
  resource: undefined
};
