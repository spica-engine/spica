export type FilterInput = Record<string, any> | string;

export function serializeFilter(filter: FilterInput): string {
  return typeof filter === 'string' ? filter : JSON.stringify(filter);
}
