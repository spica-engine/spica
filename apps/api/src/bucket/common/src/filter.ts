import {ObjectId} from "@spica-server/database";
import * as Relation from "./relation";
import {getPropertyByPath} from "./schema";
import {
  extractFilterPropertyMap,
  replaceFilter,
  replaceFilterObjectIds
} from "@spica-server/filter";
import {ValueConstructor} from "@spica-server/interface/filter";
import {FilterReplacer, RelationResolver} from "@spica-server/interface/bucket/common";
import {Bucket} from "@spica-server/interface/bucket";
import {hashValue} from "./hash";
// this reviver should be kept for backward compatibility and in case the filter is complex and our replacer can't detect the value that should be constructed
export function filterReviver(k: string, v: string, hashingKey?: string) {
  const availableConstructors = {
    Date: v => new Date(v),
    ObjectId: v => new ObjectId(v),
    ...(hashingKey && {Hashed: v => hashValue(v, hashingKey)})
  };
  const ctr = /^([a-zA-Z]+)\((.*?)\)$/;
  if (typeof v == "string" && ctr.test(v)) {
    const [, desiredCtr, arg] = v.match(ctr);
    if (availableConstructors[desiredCtr]) {
      return availableConstructors[desiredCtr](arg);
    } else {
      throw new Error(`Could not find the constructor ${desiredCtr} in {"${k}":"${v}"}`);
    }
  }
  return v;
}

export function isJSONFilter(value: any) {
  if (typeof value == "string" && value.trim().length) {
    return value.trim()[0] == "{";
  }
  return false;
}

export const constructFilterValues = async (
  filter: object,
  bucket: Bucket,
  relationResolver: RelationResolver,
  hashingKey?: string
) => {
  const replacers: FilterReplacer[] = [
    replaceFilterObjectIds,
    replaceFilterDates,
    (filter, bucket, resolver) => replaceFilterHashed(filter, bucket, resolver, hashingKey)
  ];
  for (let replacer of replacers) {
    filter = await replacer(filter, bucket, relationResolver);
  }
  return filter;
};

export async function replaceFilterDates(
  filter: object,
  bucket: Bucket,
  relationResolver: RelationResolver
) {
  const propertyMap = extractFilterPropertyMap(filter);
  const relationResolvedSchema = await Relation.getRelationResolvedBucketSchema(
    bucket,
    propertyMap,
    relationResolver
  );
  const keyValidators = [
    key => {
      const property = getPropertyByPath(relationResolvedSchema.properties, key);
      return (
        property &&
        (property.type == "date" || (property.type == "array" && property.items.type == "date"))
      );
    }
  ];
  return replaceFilter(filter, keyValidators, DateIfValid);
}

function DateIfValid(val: any): Date | typeof val {
  return !isNaN(Date.parse(val)) ? new Date(val) : val;
}

export async function replaceFilterHashed(
  filter: object,
  bucket: Bucket,
  relationResolver: RelationResolver,
  hashingKey?: string
) {
  if (!hashingKey) {
    return filter;
  }

  const propertyMap = extractFilterPropertyMap(filter);
  const relationResolvedSchema = await Relation.getRelationResolvedBucketSchema(
    bucket,
    propertyMap,
    relationResolver
  );
  const keyValidators = [
    key => {
      const property = getPropertyByPath(relationResolvedSchema.properties, key);
      return (
        property &&
        (property.type == "hashed" || (property.type == "array" && property.items.type == "hashed"))
      );
    }
  ];
  return replaceFilter(filter, keyValidators, val => HashIfValid(val, hashingKey));
}

function HashIfValid(val: any, hashingKey: string): string {
  return typeof val === "string" ? hashValue(val, hashingKey) : val;
}
