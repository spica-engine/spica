import {hash} from "@spica-server/core-encryption";
import {constructValue, LogicalExtractor} from "@spica-server/filter";
import {HashedFields} from "@spica-server/interface-data";

export function replaceHashedFields(filter: object, hashed: HashedFields): object {
  const replaced = {};
  for (const [key, value] of Object.entries(filter)) {
    if (LogicalExtractor.operators.includes(key)) {
      replaced[key] = value.map(expression => replaceHashedFields(expression, hashed));
    } else if (Object.prototype.hasOwnProperty.call(hashed.fields, key)) {
      replaced[hashed.fields[key]] = constructValue(value, given => hash(given, hashed.secret));
    } else {
      replaced[key] = value;
    }
  }
  return replaced;
}
