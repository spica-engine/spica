import * as util from "util";
import {mongodb, _mongodb} from "./mongo";

export const objectId = util.deprecate((id?: string | number | _mongodb.ObjectId) => {
  return new mongodb.ObjectId(id);
}, "objectId is deprecated, please replace it with ObjectId class.");

export const ObjectId = mongodb.ObjectId;
