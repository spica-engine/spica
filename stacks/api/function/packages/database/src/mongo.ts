import type * as _mongodb from "mongodb";

let mongodb: typeof import("mongodb") = globalThis[Symbol.for("kDatabaseDevkit")] = globalThis[Symbol.for("kDatabaseDevkit")] || require("mongodb");;
export {mongodb, _mongodb};


