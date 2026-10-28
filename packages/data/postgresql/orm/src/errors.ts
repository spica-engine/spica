import {DuplicateKeyError} from "@spica-server/data";
import {Entity} from "./entity.js";

const UNIQUE_VIOLATION = "23505";

export function translateError(error: any, entity?: Entity): Error {
  if (error?.code !== UNIQUE_VIOLATION) {
    return error;
  }
  return new DuplicateKeyError(error.message, keyValueOf(error, entity), error);
}

function keyValueOf(error: {detail?: string; constraint?: string}, entity?: Entity) {
  const keys = entity?.indexes.find(index => index.name == error.constraint)?.keys;
  const match = /^Key \((.+)\)=\((.*)\) already exists\.$/s.exec(error.detail ?? "");
  if (!match) {
    return {};
  }
  const detailNames = match[1].split(", ").map(name => name.replace(/^"(.*)"$/, "$1"));
  const values = detailNames.length == 1 ? [match[2]] : match[2].split(", ");
  if (values.length != detailNames.length) {
    return {};
  }
  const names =
    keys?.length == values.length
      ? keys
      : detailNames.map(name => entity?.byColumn.get(name)?.property ?? name);
  return Object.fromEntries(names.map((name, index) => [name, values[index]]));
}
