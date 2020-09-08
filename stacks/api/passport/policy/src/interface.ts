export interface Policy {
  _id: string;
  name: string;
  description?: string;
  statement: Statement[];
}

export interface Statement {
  action: string;
  resource?: string | string[] | {
    include: string,
    exclude: string;
  }
  module: string;
}