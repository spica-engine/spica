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
  const names = match[1].split(", ");
  const values = match[2].split(", ");
  return Object.fromEntries(
    names.map((name, index) => [entity?.byColumn.get(name)?.property ?? name, values[index]])
  );
}
