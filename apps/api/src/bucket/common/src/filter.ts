import {ObjectId} from "@spica-server/database";
import * as Relation from "./relation";
import {getPropertyByPath} from "./schema";
import {
  extractFilterPropertyMap,
  replaceFilter,
  replaceFilterObjectIds,
  replaceFilterDates as replaceReservedFilterDates
} from "@spica-server/filter";
import {ValueConstructor} from "@spica-server/interface/filter";
import {FilterReplacer, RelationResolver} from "@spica-server/interface/bucket/common";
import {Bucket} from "@spica-server/interface/bucket";
import {hash} from "@spica-server/core/schema";
// this reviver should be kept for backward compatibility and in case the filter is complex and our replacer can't detect the value that should be constructed
export function filterReviver(k: string, v: string, hashSecret?: string) {
  const availableConstructors = {
    Date: v => new Date(v),
    ObjectId: v => new ObjectId(v),
    ...(hashSecret && {Hash: v => hash(v, hashSecret)})
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
  hashSecret?: string
) => {
  console.log("constructFilterValues in:", filter);
  const replacers: FilterReplacer[] = [
    replaceFilterObjectIds,
    replaceReservedFilterDates,
    replaceFilterDates,
    (filter, bucket, resolver) => replaceFilterHash(filter, bucket, resolver, hashSecret)
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

export async function replaceFilterHash(
  filter: object,
  bucket: Bucket,
  relationResolver: RelationResolver,
  hashSecret?: string
) {
  if (!hashSecret) {
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
        (property.type == "hash" || (property.type == "array" && property.items.type == "hash"))
      );
    }
  ];
  return replaceFilter(filter, keyValidators, val => HashIfValid(val, hashSecret));
}

function HashIfValid(val: any, hashSecret: string): string {
  return typeof val === "string" ? hash(val, hashSecret) : val;
}
