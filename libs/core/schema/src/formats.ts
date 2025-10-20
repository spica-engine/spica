import {ObjectId} from "@spica-server/database";
import {Format} from "@spica-server/interface/core";
import {hash} from "./hash";

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

export function createHashFormat(hashSecret: string): Format {
  return {
    name: "hash",
    type: "string",
    coerce: (value: string) => {
      return hash(value, hashSecret);
    },
    validate: (value: string) => {
      return typeof value === "string" && value.length > 0;
    }
  };
}
