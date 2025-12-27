/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

export type RelationSelected = {
  kind: "id";
  id: string;
  label?: string;
};

export function isRelationSelected(value: any): value is RelationSelected {
  return (
    typeof value === "object" &&
    value !== null &&
    value.kind === "id" &&
    typeof value.id === "string"
  );
}

export function extractRelationId(value: any): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (isRelationSelected(value)) return value.id;
  return null;
}

