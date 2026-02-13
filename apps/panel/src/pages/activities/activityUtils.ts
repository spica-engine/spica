import type { Activity } from "../../store/api";

/** Action enum: 1=Insert, 2=Update, 3=Delete - single source of truth */
export const ACTIVITY_ACTIONS = {
  1: "Insert",
  2: "Update",
  3: "Delete"
} as const;

export const ACTION_TYPE_OPTIONS = [
  { value: 1, label: ACTIVITY_ACTIONS[1] },
  { value: 2, label: ACTIVITY_ACTIONS[2] },
  { value: 3, label: ACTIVITY_ACTIONS[3] }
];

export function formatActivityAction(action: number | string | undefined): string {
  if (action === undefined || action === null) return "-";
  const v = Number(action);
  const label = ACTIVITY_ACTIONS[v as keyof typeof ACTIVITY_ACTIONS];
  return label ?? String(action);
}

/** Capitalize first letter, lowercase rest */
export function titleCase(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function joinResource(resource: string[], separator: string): string {
  return resource.join(separator);
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/** Format resource array for display based on module (resource[0]) */
export function formatActivityResourceDisplay(resource: unknown): string {
  if (!Array.isArray(resource) || resource.length === 0) return "-";

  const arr = resource as string[];
  const module = arr[0];
  const fallbackComma = () => joinResource(arr, ", ");
  const fallbackDash = () => joinResource(arr, "-");

  switch (module) {
    case "passport":
      // (resource[1] | titlecase) + "-" + resource[2] e.g. "Policy-123"
      return isDefined(arr[1]) && isDefined(arr[2])
        ? `${titleCase(String(arr[1]))}-${arr[2]}`
        : fallbackDash();

    case "function":
    case "storage":
      return isDefined(arr[1]) ? String(arr[1]) : fallbackComma();

    case "preference":
      return isDefined(arr[1]) ? titleCase(String(arr[1])) : fallbackComma();

    case "bucket":
      if (arr[2] === "data" && isDefined(arr[3])) {
        return `Bucket Data-${arr[3]}`;
      }
      return isDefined(arr[1]) ? String(arr[1]) : fallbackComma();

    default:
      return fallbackComma();
  }
}

const MODULE_LINK_PREFIX: Record<string, string> = {
  storage: "storage-view",
  passport: "passport",
  function: "function"
};

function getResourceLink(resource: string[]): string | null {
  const [module, id] = resource;
  if (module === "preference") {
    if (id === "passport") return "passport/settings";
    if (id === "bucket") return "bucket/settings";
    return null;
  }
  if (module === "bucket") {
    return id ? `bucket/${id}` : null; // data or schema - both use bucket/:bucketId
  }
  const prefix = MODULE_LINK_PREFIX[module];
  return prefix && id ? `${prefix}/${id}` : null;
}

/** Build navigation path for activity (null if delete or no link) */
export function buildActivityLink(activity: Activity): string | null {
  if (Number(activity.action) === 3) return null; // Delete - no link

  const resource = activity.resource;
  if (!Array.isArray(resource) || resource.length === 0) return null;

  return getResourceLink(resource);
}

/** Format module name for display (resource[0]) */
export function formatActivityModule(resource: unknown): string {
  if (!Array.isArray(resource) || resource.length === 0) return "-";
  const first = (resource as string[])[0];
  return isDefined(first) ? titleCase(String(first)) : "-";
}
