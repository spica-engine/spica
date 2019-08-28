import {JSONSchema7} from "json-schema";
import {Change, ChangePaths, diff, ChangeKind} from "./differ";

export function compile(schema: JSONSchema7): JSONSchema7 {
  function map(schema: JSONSchema7): JSONSchema7 {
    if (schema.properties) {
      Object.keys(schema.properties).forEach(
        key => (schema.properties[key] = map(schema.properties[key] as JSONSchema7))
      );
    } else if (schema.items) {
      schema.items = map(schema.items as JSONSchema7);
    } else {
      switch (schema.type) {
        case "storage":
        case "richtext":
        case "textarea":
          schema.type = "string";
          break;
        case "color":
          schema.type = "string";
          break;
        case "relation":
          schema.type = "string";
          schema.format = "objectid";
          break;
        case "date":
          schema.type = "string";
          schema.format = "date-time";
          break;
        case "location":
          schema.type = "object";
          schema.required = ["longitude", "latitude"];
          schema.properties = {
            longitude: {
              title: "Longitude",
              type: "number",
              minimum: -180,
              maximum: 180
            },
            latitude: {
              title: "Latitude",
              type: "number",
              minimum: -90,
              maximum: 90
            }
          };
          break;
        default:
      }
    }
    return schema;
  }

  return map(schema);
}

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

export interface SchemaChange extends Change {
  lastPath: ChangePaths;
}
