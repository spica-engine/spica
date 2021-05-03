import {BucketDocument} from "@spica-server/bucket/services";
import JsonMergePatch = require("json-merge-patch");

export function applyPatch(previousDocument: BucketDocument, patchQuery: object) {
  const document = deepCopy(previousDocument);
  return JsonMergePatch.apply(document, patchQuery);
}

export function getUpdateQueryForPatch(query: Partial<BucketDocument>) {
  const unset = {};
  const set = {};

  const visit = (partialPatch: any, base: string = "") => {
    for (const name in partialPatch) {
      const key = base ? `${base}.${name}` : name;
      const value = partialPatch[name];
      const type = typeof value;

      if (value == null) {
        unset[key] = "";
      } else if (
        type == "boolean" ||
        type == "string" ||
        type == "number" ||
        type == "bigint" ||
        Array.isArray(value)
      ) {
        set[key] = value;
      } else if (typeof value == "object") {
        visit(value, key);
      }
    }
  };

  visit(query);

  let result: any = {};

  if (Object.keys(set).length) {
    result.$set = set;
  }

  if (Object.keys(unset).length) {
    result.$unset = unset;
  }

  if (!Object.keys(result).length) {
    return;
  }

  return result;
}

export function deepCopy(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}
