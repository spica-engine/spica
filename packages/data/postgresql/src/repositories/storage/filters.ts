import {and, matches, notEquals, notMatches, or, Where} from "@spica-server/data-postgresql-orm";

type Pattern = "wildcard" | "all_files" | "single_level" | "all_levels" | "exact";

type ResourceFilter = {include?: string[]; exclude?: string[]};

const FOLDER = "^[^/]+/$";

export const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function patternType(pattern: string): Pattern {
  if (pattern === "*") return "wildcard";
  if (pattern === "**") return "all_files";
  if (pattern.endsWith("/**")) return "all_levels";
  if (pattern.endsWith("/*")) return "single_level";
  return "exact";
}

function folderPaths(pattern: string) {
  const parts = pattern.split("/");
  return parts.slice(1).map((_, index) => `${parts.slice(0, index + 1).join("/")}/`);
}

function include(pattern: string): Where {
  switch (patternType(pattern)) {
    case "wildcard":
      return or({name: notMatches("/")}, {name: matches(FOLDER)});
    case "all_files":
      return and();
    case "single_level":
      return {name: matches(`^${escapeRegex(pattern.slice(0, -2))}/[^/]+/?$`)};
    case "all_levels": {
      const base = pattern.slice(0, -3);
      return or({name: matches(`^${escapeRegex(base)}/`)}, {name: `${base}/`});
    }
    default:
      return or({name: pattern}, ...folderPaths(pattern).map(folder => ({name: folder})));
  }
}

function exclude(pattern: string): Where {
  switch (patternType(pattern)) {
    case "wildcard":
      return and({name: matches("/")}, {name: notMatches(FOLDER)});
    case "all_files":
      return or();
    case "single_level":
      return {name: notMatches(`^${escapeRegex(pattern.slice(0, -2))}/[^/]+/?$`)};
    case "all_levels": {
      const base = pattern.slice(0, -3);
      return and({name: notMatches(`^${escapeRegex(base)}/`)}, {name: notEquals(`${base}/`)});
    }
    default:
      return and(
        {name: notEquals(pattern)},
        ...folderPaths(pattern).map(folder => ({name: notEquals(folder)}))
      );
  }
}

export function resourceWhere(resourceFilter: ResourceFilter | undefined): Where {
  const included = resourceFilter?.include?.length
    ? [or(...resourceFilter.include.map(include))]
    : [];
  return and(...included, ...(resourceFilter?.exclude ?? []).map(exclude));
}

export function pathWhere(path: string | undefined): Where {
  const trimmed = path?.startsWith("/") ? path.slice(1) : (path ?? "");
  if (!trimmed) {
    return or({name: notMatches("/")}, {name: matches(FOLDER)});
  }
  return {name: matches(`^${escapeRegex(trimmed)}/[^/]+/?$`)};
}

export function browseWhere(resourceFilter: ResourceFilter | undefined, path: string | undefined) {
  return and(resourceWhere(resourceFilter), pathWhere(path));
}
