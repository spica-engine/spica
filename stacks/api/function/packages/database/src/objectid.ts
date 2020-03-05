import {ObjectId} from "mongodb";
import * as util from "util";

export const objectId = util.deprecate((id?: string | number | ObjectId) => {
  return new ObjectId(id);
}, "objectId is deprecated, please replace it with ObjectId class.");
