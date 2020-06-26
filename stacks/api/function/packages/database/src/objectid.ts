const mongodb = require("mongodb");
import * as util from "util";

export const objectId = util.deprecate((id?: string | number | typeof mongodb.ObjectId) => {
  return new mongodb.ObjectId(id);
}, "objectId is deprecated, please replace it with ObjectId class.");
