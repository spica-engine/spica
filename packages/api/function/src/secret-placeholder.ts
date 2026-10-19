const SECRET_PLACEHOLDER = /\$\{SECRET\.([^{}\s]+)\}/g;

export function extractSecretKeys(value: unknown): string[] {
  const keys = new Set<string>();
  for (const str of collectStrings(value)) {
    for (const [, key] of str.matchAll(SECRET_PLACEHOLDER)) {
      keys.add(key);
    }
  }
  return Array.from(keys);
}

export function hasSecretPlaceholder(value: unknown, keys: string[]): boolean {
  return extractSecretKeys(value).some(key => keys.includes(key));
}

export function resolveSecretPlaceholders<T>(value: T, secrets: Map<string, string>): T {
  return mapStrings(value, str =>
    str.replace(SECRET_PLACEHOLDER, (placeholder, key) =>
      secrets.has(key) ? secrets.get(key) : placeholder
    )
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
