import {FilterLanguageError} from "./errors.js";

export type FilterLanguage = "json" | "expression";

export function filterLanguageOf(filter: unknown): FilterLanguage | undefined {
  if (typeof filter == "string") {
    return filter.trim() ? "expression" : undefined;
  }
  if (filter && typeof filter == "object" && Object.keys(filter).length) {
    return "json";
  }
  return undefined;
}

/**
 * An empty filter belongs to every language, so clients that send `{}` keep working on any engine.
 */
export function assertFilterLanguage(
  filter: unknown,
  accepted: FilterLanguage[],
  engine: string
): void {
  const language = filterLanguageOf(filter);
  if (language && !accepted.includes(language)) {
    throw new FilterLanguageError(
      `A ${language} filter is not supported on ${engine}. Use a ${accepted.join(" or ")} filter.`
    );
  }
}
