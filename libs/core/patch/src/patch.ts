import JsonMergePatch = require("json-merge-patch");

export function applyPatch(previousDocument: object, patchQuery: object) {
  const document = deepCopy(previousDocument);
  return JsonMergePatch.apply(document, patchQuery);
}

export function getUpdateQueryForPatch(query: Partial<object>, patchedDocument: object) {
  const unset = {};
  const set = {};

  const visit = (partialPatch: any, base: string, patchedDocument: object) => {
    for (const name in partialPatch) {
      const target = base ? `${base}.${name}` : name;
      const key = name;

      const patchValue = partialPatch[name];
      const type = typeof patchValue;

      if (patchValue == null) {
        unset[target] = "";
      } else if (
        (type == "boolean" ||
          type == "string" ||
          type == "number" ||
          type == "bigint" ||
          Array.isArray(patchValue)) &&
        // if patched document does not include this patch query field, it means this field is non existing schema field
        Object.keys(patchedDocument).includes(key)
      ) {
        // patch query does not include some special types like date-string, but patched document does
        set[target] = patchedDocument[key];
      } else if (typeof patchValue == "object") {
        visit(patchValue, target, patchedDocument[key]);
      }
    }
  };

  visit(query, "", patchedDocument);

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

export function deepCopy(value: object) {
  return JSON.parse(JSON.stringify(value));
}
