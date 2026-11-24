export interface NumericRule {
  min: number;
  integer: boolean;
}

export function parseNumber(raw: unknown, rule: NumericRule): number | undefined {
  const value = typeof raw == "string" && raw.trim() != "" ? Number(raw) : raw;
  const valid =
    typeof value == "number" &&
    Number.isFinite(value) &&
    value >= rule.min &&
    (!rule.integer || Number.isInteger(value));
  return valid ? (value as number) : undefined;
}
