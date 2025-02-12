import type * as _mongodb from "mongodb";
import * as mongo from "mongodb";

let mongodb: typeof import("mongodb") = (globalThis[Symbol.for("kDatabaseDevkit")] =
  globalThis[Symbol.for("kDatabaseDevkit")] || mongo);

export {mongodb, _mongodb};
