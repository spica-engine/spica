import {JSONSchema7} from "json-schema";
import {diff} from "./differ.js";
import {ChangeKind, SchemaChange, ChangePaths} from "@spica-server/interface-core";

function walkSchemaPaths(paths: ChangePaths, schema: JSONSchema7, positional: boolean) {
  const schemaPaths: any[] = [];
  let node: any = schema;
  let cursor = 0;

  while (cursor < paths.length && node && typeof node == "object") {
    const key = paths[cursor];

    if (key == "properties" && node.properties) {
      const name = paths[cursor + 1];
      if (name == undefined) {
        break;
      }
      schemaPaths.push(name);
      node = node.properties[name];
      cursor += 2;
      continue;
    }

    if (key == "items" && node.type == "array" && node.items) {
      if (Array.isArray(node.items)) {
        const itemIndex = paths[cursor + 1];
        if (itemIndex == undefined) {
          break;
        }
        schemaPaths.push(itemIndex);
        node = node.items[itemIndex];
        cursor += 2;
      } else {
        schemaPaths.push(positional ? /[0-9]*/ : key);
        node = node.items;
        cursor += 1;
      }
      continue;
    }

    break;
  }

  return {schemaPaths, keywordPaths: paths.slice(cursor)};
}

export function clearSchemaPaths(
  paths: ChangePaths,
  schema: JSONSchema7,
  positional: boolean = false
) {
  return walkSchemaPaths(paths, schema, positional).schemaPaths;
}

export function getLastNonSchemaPaths(paths: ChangePaths, schema: JSONSchema7) {
  return walkSchemaPaths(paths, schema, false).keywordPaths;
}

export function schemaDiff(prev: JSONSchema7, current: JSONSchema7): SchemaChange[] {
  return diff(prev, current).map((change: SchemaChange) => {
    const {schemaPaths, keywordPaths} = walkSchemaPaths(
      change.path,
      change.kind == ChangeKind.Delete ? prev : current,
      true /* array.items to regex */
    );
    change.path = schemaPaths;
    change.lastPath = keywordPaths;
    return change as SchemaChange;
  });
}
