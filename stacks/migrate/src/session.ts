import type * as mongodb from "mongodb";

let _session: mongodb.ClientSession;

export function getSession(): mongodb.ClientSession {
  return _session;
}
export function setSession(session: mongodb.ClientSession) {
  _session = session;
}

const op = require("mongodb/lib/operations/operation");
const OperationBase = op.OperationBase;
op.OperationBase = class extends OperationBase {
  constructor(options) {
    super(options);
    this.options = Object.assign({}, options);
    if (!this.options.session) {
      this.options.session = getSession();
    }
  }
};
