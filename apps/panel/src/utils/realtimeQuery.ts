import {serializeFilter, type FilterInput} from "./serializeFilter";

export function realtimeSort(sort: object | undefined, keyField: string | undefined): string {
  return JSON.stringify(sort ?? {[keyField ?? "_id"]: -1});
}

export function realtimeFilter(filter: FilterInput | undefined): string {
  return filter ? serializeFilter(filter) : "";
}
