/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

export type RelationColumn = {
  key: string;
  value: string;
};

// Per relation FIELD choice for how it reads in the list view: the raw `_id`
// or the related bucket's primary field value. Persisted in localStorage so the
// setting survives reloads without a server round-trip.
export type RelationLabelMode = "id" | "primary";

// A relation field left "id" reads as its raw id and does NOT need the API to
// resolve the relation; only "primary" fields must be resolved. Stored per
// bucket as a map keyed by the relation field's property key.
export type RelationLabelModeMap = Record<string, RelationLabelMode>;

// Legacy single-value key (one mode for the whole bucket). Retained only so the
// per-field map can migrate from it gracefully.
export function relationLabelModeKey(bucketId: string): string {
  return `${bucketId}-relation-label`;
}

export function relationLabelModeMapKey(bucketId: string): string {
  return `${bucketId}-relation-labels`;
}

export function getRelationFieldKeys(properties?: Record<string, any>): string[] {
  if (!properties) return [];
  return Object.entries(properties)
    .filter(([, property]) => property?.type === "relation")
    .map(([key]) => key);
}

// A field with no explicit entry defaults to "primary" (resolved value shown).
export function resolveRelationFieldMode(
  map: RelationLabelModeMap | undefined,
  fieldKey: string
): RelationLabelMode {
  return map?.[fieldKey] ?? "primary";
}

// Reads the deprecated single-value setting so a bucket that only has the old
// key can seed its new per-field map with the same choice for every field.
export function readLegacyRelationLabelMode(bucketId: string): RelationLabelMode | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(relationLabelModeKey(bucketId));
    if (!raw) return null;
    const value = JSON.parse(raw);
    return value === "id" || value === "primary" ? value : null;
  } catch {
    return null;
  }
}

export function seedRelationLabelMap(
  bucketId: string,
  relationFieldKeys: string[]
): RelationLabelModeMap {
  const legacy = readLegacyRelationLabelMode(bucketId);
  if (!legacy) return {};
  return relationFieldKeys.reduce<RelationLabelModeMap>((map, key) => {
    map[key] = legacy;
    return map;
  }, {});
}

/**
 * The list-data request only needs the API to resolve relations that are shown
 * as their primary value. Maps a bucket's relation fields + per-field config to
 * the `relation` query arg:
 *  - all fields "primary" → `true` (resolve everything)
 *  - some "primary"       → the "primary" field keys (resolve those one-by-one)
 *  - none "primary" / no relation fields → `undefined` (omit — resolve nothing)
 */
export function computeRelationParam(
  relationFieldKeys: string[],
  map: RelationLabelModeMap | undefined
): boolean | string[] | undefined {
  if (relationFieldKeys.length === 0) return undefined;

  const primaryKeys = relationFieldKeys.filter(
    key => resolveRelationFieldMode(map, key) === "primary"
  );

  if (primaryKeys.length === 0) return undefined;
  if (primaryKeys.length === relationFieldKeys.length) return true;
  return primaryKeys;
}

export function getPrimaryFieldKey(
  properties: Record<string, any>,
  primaryFieldKey?: string
): string {
  if (!properties) return "_id";

  if (primaryFieldKey && properties[primaryFieldKey] !== undefined) {
    return primaryFieldKey;
  }

  for (const [key, property] of Object.entries(properties)) {
    if (property?.isPrimary === true) {
      return key;
    }
  }

  if (properties.title !== undefined) {
    return "title";
  }

  return "_id";
}

/**
 * Resolution order for a relation's readable field(s): the bucket-level
 * `primary` key (e.g. `bucket.primary === "name"`) wins when present in the
 * schema, then any `isPrimary`-flagged fields, then the legacy `title`, then
 * none. `_id` is rendered separately by the caller.
 */
export function getPrimaryFieldKeys(
  properties: Record<string, any>,
  primaryFieldKey?: string
): string[] {
  if (!properties) return [];

  if (primaryFieldKey && properties[primaryFieldKey] !== undefined) {
    return [primaryFieldKey];
  }

  const primaryKeys = Object.entries(properties)
    .filter(([, property]) => property?.isPrimary === true)
    .map(([key]) => key);

  if (primaryKeys.length > 0) return primaryKeys;

  if (properties.title !== undefined) return ["title"];

  return [];
}

export function extractPrimaryColumns(
  item: Record<string, any>,
  properties: Record<string, any>,
  primaryFieldKey?: string
): RelationColumn[] {
  return getPrimaryFieldKeys(properties, primaryFieldKey).reduce<RelationColumn[]>(
    (columns, key) => {
      const value = item?.[key];
      if (value !== undefined && value !== null && value !== "") {
        columns.push({key, value: String(value)});
      }
      return columns;
    },
    []
  );
}

export function extractPrimaryFieldValue(
  item: Record<string, any>,
  properties: Record<string, any>,
  primaryFieldKey?: string
): string {
  const primaryKey = getPrimaryFieldKey(properties, primaryFieldKey);
  const value = item[primaryKey];

  if (value === undefined || value === null || value === "") {
    return item._id || "";
  }

  return String(value);
}

