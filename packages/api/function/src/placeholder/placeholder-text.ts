export type PlaceholderPrefix = "SECRET" | "ENV";

export interface Placeholder {
  prefix: PlaceholderPrefix;
  key: string;
}

export type PlaceholderLookup = (placeholder: Placeholder) => string | undefined;

const PLACEHOLDER = /\$\{(SECRET|ENV)\.([^{}\s]+)\}/g;
const WHOLE_PLACEHOLDER = /^\$\{(SECRET|ENV)\.([^{}\s]+)\}$/;

export const WHOLE_PLACEHOLDER_PATTERN = WHOLE_PLACEHOLDER.source;

export function extractPlaceholders(value: unknown): Placeholder[] {
  const found: Placeholder[] = [];
  for (const str of collectStrings(value)) {
    for (const [, prefix, key] of str.matchAll(PLACEHOLDER)) {
      found.push({prefix: prefix as PlaceholderPrefix, key});
    }
  }
  return found;
}

export function references(value: unknown, prefix: PlaceholderPrefix, keys?: string[]): boolean {
  return extractPlaceholders(value).some(
    placeholder => placeholder.prefix == prefix && (!keys || keys.includes(placeholder.key))
  );
}

export function substitute<T>(value: T, lookup: PlaceholderLookup): T {
  return mapStrings(value, str =>
    str.replace(PLACEHOLDER, (literal, prefix, key) => {
      const resolved = lookup({prefix, key});
      return resolved === undefined ? literal : resolved;
    })
  );
}

function* collectStrings(value: unknown): Generator<string> {
  if (typeof value == "string") {
    yield value;
  } else if (Array.isArray(value)) {
    for (const item of value) yield* collectStrings(item);
  } else if (isPlainObject(value)) {
    for (const item of Object.values(value)) yield* collectStrings(item);
  }
}

function mapStrings<T>(value: T, map: (str: string) => string): T {
  if (typeof value == "string") {
    return map(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map(item => mapStrings(item, map)) as T;
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, mapStrings(item, map)])
    ) as T;
  }
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value != "object") {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
