import {Statement} from "./statement";

export const EMPTY_POLICY: Policy = {
  name: undefined,
  description: undefined,
  statement: []
};

export interface Policy {
  _id?: string;
  name: string;
  system?: boolean;
  description: string;
  statement: Statement[];
}

export function emptyPolicy(): Policy {
  return {name: undefined, description: undefined, statement: []};
}
