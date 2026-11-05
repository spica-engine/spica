const RESOLVE_MARKER = "_id";

export const markRelationsToResolve = (paths: string[][] = []): string[][] =>
  paths.map(path => (path.at(-1) == RESOLVE_MARKER ? path : [...path, RESOLVE_MARKER]));
