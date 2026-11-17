import {ResourceFilterSpec} from "@spica-server/interface-data";

export function renderResourceFilter(
  filter: ResourceFilterSpec | undefined,
  parseId: (id: string) => unknown
): {$match: object} | undefined {
  if (!filter) {
    return undefined;
  }

  const alternatives: object[] = filter.exclude.map(exclude => ({
    _id: {$nin: Array.from(new Set(exclude)).map(parseId)}
  }));

  if (filter.include.length) {
    alternatives.push({_id: {$in: Array.from(new Set(filter.include)).map(parseId)}});
  }

  return {$match: alternatives.length ? {$or: alternatives} : {}};
}
