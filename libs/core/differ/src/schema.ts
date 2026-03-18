import {JSONSchema7} from "json-schema";
import {diff} from "./differ";
import {ChangeKind, SchemaChange, ChangePaths} from "@spica-server/interface/core";

export function clearSchemaPaths(
  paths: ChangePaths,
  schema: JSONSchema7,
  positional: boolean = false
) {
  const newPaths = [];
  let restPath = [];

  for (const path of paths) {
    const prevSchema = schema;
    schema = schema[path];
    if (
      path == "items" &&
      schema &&
      schema.type &&
      prevSchema &&
      prevSchema.type == "array" &&
      positional
    ) {
      newPaths.push(/[0-9]*/);
      restPath = [];
    } else if (schema && schema.type) {
      newPaths.push(path);
      restPath = [];
    } else {
      restPath.push(path);
    }
  }

  return newPaths;
}

export function getLastNonSchemaPaths(paths: ChangePaths, schema: JSONSchema7) {
  let restPath = [];
  for (const path of paths) {
    schema = schema[path];
    if (schema && schema.type) {
      restPath = [];
    } else {
      restPath.push(path);
    }
  }
  return restPath;
}

export function schemaDiff(prev: JSONSchema7, current: JSONSchema7): SchemaChange[] {
  return diff(prev, current).map((change: SchemaChange) => {
    change.lastPath = getLastNonSchemaPaths(
      change.path,
      change.kind == ChangeKind.Delete ? prev : current
    );
    change.path = clearSchemaPaths(
      change.path,
      change.kind == ChangeKind.Delete ? prev : current,
      true /* array.items to regex */
    );
    return change as SchemaChange;
  });
}
