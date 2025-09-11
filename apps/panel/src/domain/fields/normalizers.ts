/**
 * Normalizers & Sanitizers
 * ------------------------------------------------------------
 * Shared helpers to centralize enumeration & pattern cleanup logic.
 * (Phase 1 introduction – to be adopted in facade/build pipeline later.)
 */

export interface NormalizeEnumOptions {
  trim?: boolean;        // remove surrounding whitespace
  dedupe?: boolean;      // remove duplicate values preserving first occurrence
  coerceNumber?: boolean;// attempt to coerce numeric-looking strings to numbers
  dropEmpty?: boolean;   // remove empty string values
}

export function normalizeEnum(values: any, opts: NormalizeEnumOptions = {}) {
  if (!Array.isArray(values)) return [];
  const out: (string | number)[] = [];
  const seen = new Set<string>();
  for (let v of values) {
    if (v == null) continue;
    if (typeof v !== "string" && typeof v !== "number") v = String(v);
    let key: string | number = v as any;
    if (typeof key === "string" && opts.trim) key = key.trim();
    if (opts.dropEmpty && key === "") continue;
    if (opts.coerceNumber && typeof key === "string" && key.length && !isNaN(Number(key))) {
      key = Number(key);
    }
    const sig = typeof key + ":" + key;
    if (opts.dedupe) {
      if (seen.has(sig)) continue;
      seen.add(sig);
    }
    out.push(key);
  }
  return out;
}

export function sanitizePattern(pattern: any): string | undefined {
  if (typeof pattern !== "string") return undefined;
  const trimmed = pattern.trim();
  if (!trimmed.length) return undefined;
  try {
    // Validate regex construction (no usage of result necessary here)
    new RegExp(trimmed);
    return trimmed;
  } catch {
    return undefined;
  }
}

export function ensureArray<T>(value: T | T[] | undefined, fallback: T[] = []) {
  if (Array.isArray(value)) return value;
  if (value == null) return fallback;
  return [value];
}

// Placeholder for future macro normalization (dates, etc.)
export function normalizeDefaultMacro(value: any, allowed: string[] = []) {
  if (typeof value !== "string") return value;
  if (allowed.includes(value)) return value; // accepted macro
  return value; // unchanged for now
}

export const enumNormalizers = {
  default: (vals: any[]) => normalizeEnum(vals, {trim: true, dedupe: true, dropEmpty: true}),
  numeric: (vals: any[]) => normalizeEnum(vals, {trim: true, dedupe: true, dropEmpty: true, coerceNumber: true})
};
