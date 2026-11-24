export type PlaceholderSource = "ENV" | "SECRET";

export interface PlaceholderReference {
  source: PlaceholderSource;
  key: string;
}

const WHOLE_PLACEHOLDER = /^\$\{(SECRET|ENV)\.([^{}\s]+)\}$/;

export function parsePlaceholder(value: unknown): PlaceholderReference | null {
  const match = typeof value == "string" ? WHOLE_PLACEHOLDER.exec(value) : null;
  return match ? {source: match[1] as PlaceholderSource, key: match[2]} : null;
}

export function toPlaceholder({source, key}: PlaceholderReference): string {
  return `\${${source}.${key}}`;
}

export function isPlaceholder(value: unknown): value is string {
  return parsePlaceholder(value) !== null;
}

export function unattachedReferences(
  values: unknown[],
  attached: ReadonlySet<string>
): PlaceholderReference[] {
  const unique = new Map<string, PlaceholderReference>();
  for (const value of values) {
    const reference = parsePlaceholder(value);
    if (reference && !attached.has(value as string)) {
      unique.set(value as string, reference);
    }
  }
  return [...unique.values()];
}
