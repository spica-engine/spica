import {ObjectId} from "@spica/database";
import {Format} from "./interface";

export const OBJECT_ID: Format = {
  name: "objectid",
  type: "string",
  coerce: bucketId => {
    return new ObjectId(bucketId);
  },
  validate: objectId => {
    return ObjectId.isValid(objectId);
  }
};

export const OBJECTID_STRING: Format = {
  name: "objectid-string",
  type: "string",
  validate: objectId => {
    return ObjectId.isValid(objectId);
  }
};

export const DATE_TIME: Format = {
  name: "date-time",
  type: "string",
  coerce: date => new Date(date),
  validate: date => {
    return /^\d\d\d\d-[0-1]\d-[0-3]\d[t\s](?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)$/i.test(
      String(date)
    );
  }
};
