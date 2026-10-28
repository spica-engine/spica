import {DuplicateKeyError} from "@spica-server/data";
import {Entity} from "./entity.js";

const UNIQUE_VIOLATION = "23505";

export function translateError(error: any, entity?: Entity): Error {
  if (error?.code !== UNIQUE_VIOLATION) {
    return error;
  }
  return new DuplicateKeyError(error.message, keyValueOf(error.detail, entity), error);
}

function keyValueOf(detail: string | undefined, entity?: Entity) {
  const match = /^Key \((.+)\)=\((.*)\) already exists\.$/s.exec(detail ?? "");
  if (!match) {
    return {};
  }
  const names = match[1].split(", ").map(name => name.replace(/^"(.*)"$/, "$1"));
  const values = names.length == 1 ? [match[2]] : match[2].split(", ");
  if (values.length != names.length) {
    return {};
  }
  return Object.fromEntries(
    names.map((name, index) => [entity?.byColumn.get(name)?.property ?? name, values[index]])
  );
}
