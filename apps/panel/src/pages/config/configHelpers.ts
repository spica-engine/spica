import type {ConfigSchemaProperty} from "../../store/api/configApi";

export function humanize(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

let _nextId = 0;
export function genId(): string {
  return `_pid_${_nextId++}`;
}

export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

export function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const keys = path.split(".");
  const result = JSON.parse(JSON.stringify(obj)) as Record<string, unknown>;
  let current: Record<string, unknown> = result;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]] || typeof current[keys[i]] !== "object") {
      current[keys[i]] = {};
    }
    current = current[keys[i]] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
  return result;
}

type ArrayItem = Record<string, unknown> & {_id?: string};

function addIdsToArrays(obj: unknown, schema: ConfigSchemaProperty | undefined): unknown {
  if (!schema) return obj;

  if (schema.type === "array" && Array.isArray(obj)) {
    return (obj as ArrayItem[]).map(item => ({
      ...item,
      _id: item._id ?? genId()
    }));
  }

  if (schema.type === "object" && schema.properties && obj && typeof obj === "object") {
    const result = {...(obj as Record<string, unknown>)};
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (result[key] !== undefined) {
        result[key] = addIdsToArrays(result[key], propSchema);
      }
    }
    return result;
  }

  return obj;
}

function stripIdsFromArrays(obj: unknown, schema: ConfigSchemaProperty | undefined): unknown {
  if (!schema) return obj;

  if (schema.type === "array" && Array.isArray(obj)) {
    return (obj as ArrayItem[]).map(({_id, ...rest}) => rest);
  }

  if (schema.type === "object" && schema.properties && obj && typeof obj === "object") {
    const result = {...(obj as Record<string, unknown>)};
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (result[key] !== undefined) {
        result[key] = stripIdsFromArrays(result[key], propSchema);
      }
    }
    return result;
  }

  return obj;
}

export function prepareOptions(
  options: Record<string, unknown>,
  schema?: ConfigSchemaProperty
): Record<string, unknown> {
  const opts = JSON.parse(JSON.stringify(options)) as Record<string, unknown>;
  if (!schema) return opts;
  return addIdsToArrays(opts, schema) as Record<string, unknown>;
}

export function sanitizeForSave(
  options: Record<string, unknown>,
  schema?: ConfigSchemaProperty
): Record<string, unknown> {
  const result = JSON.parse(JSON.stringify(options)) as Record<string, unknown>;
  if (!schema) return result;
  return stripIdsFromArrays(result, schema) as Record<string, unknown>;
}