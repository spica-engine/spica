import type {DataEngine} from "../store/api/statusApi";
import type {FilterInput} from "../utils/serializeFilter";
import {bucketKeyField} from "../utils/recordKey";
import {isFieldPath} from "../components/prefabs/filter-panel/filterPanelUtils";

export type RelationTarget = {
  keyField: string;
  labelField?: string;
};

type BucketLike = {primary?: string; properties?: Record<string, any>};

const LABEL_TYPES = new Set(["string", "textarea"]);

export function relationLabelField(
  engine: DataEngine | undefined,
  bucket: BucketLike | undefined | null
): string | undefined {
  if (!bucket) return undefined;
  if (engine !== "postgresql") return bucket.primary || undefined;

  const keyField = bucket.primary;
  return Object.entries(bucket.properties ?? {}).find(
    ([key, property]) => key !== keyField && LABEL_TYPES.has((property as any)?.type)
  )?.[0];
}

export function relationTarget(
  engine: DataEngine | undefined,
  bucket: BucketLike | undefined | null
): RelationTarget | undefined {
  const keyField = bucketKeyField(engine, bucket);
  if (!keyField) return undefined;
  return {keyField, labelField: relationLabelField(engine, bucket)};
}

export function relationValueId(value: unknown, keyField?: string): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (typeof value !== "object") return undefined;

  const record = value as Record<string, any>;
  const candidates = [keyField ? record[keyField] : undefined, record.value, record.kind === "id" ? record.id : undefined, record._id];
  const found = candidates.find(
    candidate => typeof candidate === "string" || typeof candidate === "number"
  );
  return found === undefined || found === "" ? undefined : String(found);
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function relationSearchFilter(
  engine: DataEngine | undefined,
  labelField: string | undefined,
  search: string | undefined
): FilterInput | undefined {
  if (!search) return undefined;

  if (engine === "postgresql") {
    if (!labelField || !isFieldPath(labelField)) return undefined;
    return `regex(document.${labelField}, ${JSON.stringify(escapeRegex(search))}, "i")`;
  }

  return {$or: [{[labelField || "_id"]: {$regex: search, $options: "i"}}]};
}
