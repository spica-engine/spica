/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

/**
 * Normalized value type for relation selections.
 * Used across RelationMinimized, RelationCell, and filter handlers.
 */
export type RelationSelected = {
  kind: "id";
  id: string;
  label?: string;
};

/**
 * Type guard to check if a value is a RelationSelected object
 */
export function isRelationSelected(value: any): value is RelationSelected {
  return (
    typeof value === "object" &&
    value !== null &&
    value.kind === "id" &&
    typeof value.id === "string"
  );
}

/**
 * Extracts the ID from various relation value formats
 */
export function extractRelationId(value: any): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (isRelationSelected(value)) return value.id;
  return null;
}

