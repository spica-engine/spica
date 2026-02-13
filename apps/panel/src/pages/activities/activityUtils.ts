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

/** Format resource array for display based on module (resource[0]) */
export function formatActivityResourceDisplay(resource: string[] | unknown): string {
  if (!Array.isArray(resource) || resource.length === 0) return "-";

  const module = resource[0];

  switch (module) {
    case "passport":
      // (resource[1] | titlecase) + "-" + resource[2] e.g. "Policy-123"
      return resource[1] != null && resource[2] != null
        ? `${titleCase(String(resource[1]))}-${resource[2]}`
        : (resource as string[]).join("-");

    case "function":
      return resource[1] != null ? String(resource[1]) : (resource as string[]).join(", ");

    case "preference":
      return resource[1] != null ? titleCase(String(resource[1])) : (resource as string[]).join(", ");

    case "storage":
      return resource[1] != null ? String(resource[1]) : (resource as string[]).join(", ");

    case "bucket":
      if (resource[2] === "data" && resource[3] != null) {
        return `Bucket Data-${resource[3]}`;
      }
      return resource[1] != null ? String(resource[1]) : (resource as string[]).join(", ");

    default:
      return (resource as string[]).join(", ");
  }
}

/** Build navigation path for activity (null if delete or no link) */
export function buildActivityLink(activity: Activity): string | null {
  if (Number(activity.action) === 3) return null; // Delete - no link

  const resource = activity.resource;
  if (!Array.isArray(resource) || resource.length === 0) return null;

  const module = resource[0];

  switch (module) {
    case "storage":
      return resource[1] ? `storage-view/${resource[1]}` : null;

    case "passport":
      if (resource[1]) {
        return `passport/${resource[1]}`; // passport/identity, passport/policy, passport/apikey
      }
      return null;

    case "preference":
      if (resource[1] === "passport") return "passport/settings";
      if (resource[1] === "bucket") return "bucket/settings";
      return null;

    case "function":
      return resource[1] ? `function/${resource[1]}` : null;

    case "bucket":
      if (resource[2] === "data" && resource[1] && resource[3]) {
        return `bucket/${resource[1]}`; // Bucket data - panel uses bucket/:bucketId
      }
      return resource[1] ? `bucket/${resource[1]}` : null;

    default:
      return null;
  }
}

/** Format module name for display (resource[0]) */
export function formatActivityModule(resource: string[] | unknown): string {
  if (!Array.isArray(resource) || resource.length === 0) return "-";
  const first = resource[0];
  return first != null ? titleCase(String(first)) : "-";
}
