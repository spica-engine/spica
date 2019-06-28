import {EMPTY_INPUT_SCHEMA, InputSchema} from "@spica-client/common/input";

export function visitKey(value: any, key?: any): InputSchema {
  const meta: InputSchema | any = {...EMPTY_INPUT_SCHEMA};
  meta.name = key;
  if (Array.isArray(value)) {
    const val = value[0];
    meta.type = "array";
    meta.typeOfOne = visitKey(val);
  } else if (typeof value === "object" && value !== null && !!value) {
    meta.type = "object";
    meta.properties = [];
    const keys = Object.keys(value);
    for (const _key of keys) {
      if (key === "_id") {
        continue;
      }
      const input = visitKey(value[_key], _key);
      if (input) {
        meta.properties.push(input);
      }
    }
  } else {
    meta.name = key;
    meta.type = typeof value;

    if (typeof value === "string" && value.length > 100) {
      meta.type = "textarea";
    }
  }
  return meta;
}
