export interface Statement {
  action: string;
  resource?: Resource;
  module: string;
}

export interface Resource {
  include: string[];
  exclude: string[];
}

export interface DisplayedStatement {
  module: string;
  actions: DisplayedAction[];
}

export interface DisplayedAction {
  name: string;
  resource?: Resource;
}

export const EMPTY_STATEMENT: Statement = {
  module: undefined,
  action: undefined,
  resource: undefined
};
