import {serializeFilter, type FilterInput} from "./serializeFilter";

import {DEFAULT_KEY_FIELD} from "./recordKey";
export function realtimeSort(sort: object | undefined, keyField: string | undefined): string {
  return JSON.stringify(sort ?? {[keyField ?? DEFAULT_KEY_FIELD]: -1});
}

export function realtimeFilter(filter: FilterInput | undefined): string {
  return filter ? serializeFilter(filter) : "";
}
