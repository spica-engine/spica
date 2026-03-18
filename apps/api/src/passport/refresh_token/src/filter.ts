import {replaceFilter} from "@spica-server/filter";
import {hash} from "@spica-server/core/schema";

/**
 * Replaces the `token` field values in a filter with their hashed equivalents.
 * Handles recursive cases like $or, $and, $nor and comparison operators like $in, $eq.
 *
 * @param filter The filter object to transform
 * @param hashSecret The secret used to hash token values
 * @returns Transformed filter with hashed token values
 */
export function replaceRefreshTokenFilter(filter: object, hashSecret: string): object {
  const keyValidators = [key => key === "token"];
  return replaceFilter(filter, keyValidators, val => hashIfValid(val, hashSecret));
}

function hashIfValid(val: any, hashSecret: string): any {
  return typeof val === "string" ? hash(val, hashSecret) : val;
}
