import * as mongodb from "mongodb";
import * as operation from "mongodb/lib/operations/operation";

let _session: mongodb.ClientSession;

export function getSession(): mongodb.ClientSession {
  return _session;
}
export function setSession(session: mongodb.ClientSession) {
  _session = session;
}

Object.defineProperty(operation.AbstractOperation.prototype, "_options", {
  writable: true
});

Object.defineProperty(operation.AbstractOperation.prototype, "options", {
  enumerable: true,
  configurable: false,
  set: function (options) {
    this._options = Object.assign({}, options);
    if (!this._options.session) {
      this._options.session = getSession();
    }
  },
  get: function () {
    return this._options;
  }
});
