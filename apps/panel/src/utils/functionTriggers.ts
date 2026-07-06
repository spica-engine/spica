import type {SpicaFunction, TriggerMap, FunctionTrigger} from "../store/api/functionApi";

export type NormalizedTrigger = {
  name: string;
  type: string;
  active: boolean;
  options: Record<string, any>;
};

// Triggers arrive either as a keyed map (persisted shape) or an array (the
// per-function endpoint), so callers get a single normalized list regardless.
export const normalizeTriggers = (fn: SpicaFunction): NormalizedTrigger[] => {
  const triggers = fn.triggers;
  if (!triggers) return [];

  if (Array.isArray(triggers)) {
    return (triggers as FunctionTrigger[]).map((trigger, index) => ({
      name: trigger.handler ?? `handler_${index}`,
      type: trigger.type,
      active: trigger.active !== false,
      options: trigger.options ?? {}
    }));
  }

  return Object.entries(triggers as TriggerMap).map(([name, trigger]) => ({
    name,
    type: trigger.type,
    active: trigger.active !== false,
    options: trigger.options ?? {}
  }));
};

// Human-readable summary of the trigger's key options for the documentation list.
export const describeTriggerOptions = (trigger: NormalizedTrigger): string[] => {
  const {type, options} = trigger;
  switch (type) {
    case "http":
      return [`${options.method ?? "ALL"} ${options.path ?? "/"}`.trim()];
    case "schedule":
      return [
        options.frequency ? `cron: ${options.frequency}` : "",
        options.timezone ? `tz: ${options.timezone}` : ""
      ].filter(Boolean);
    case "bucket":
      return [
        options.bucket ? `bucket: ${options.bucket}` : "",
        options.type ? `phase: ${options.type}` : ""
      ].filter(Boolean);
    case "database":
      return [
        options.collection ? `collection: ${options.collection}` : "",
        options.type ? `op: ${options.type}` : ""
      ].filter(Boolean);
    case "firehose":
      return options.event ? [`event: ${options.event}`] : [];
    case "system":
      return options.name ? [`event: ${options.name}`] : [];
    default:
      return [];
  }
};
