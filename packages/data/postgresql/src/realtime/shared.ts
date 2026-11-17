import {createHash} from "node:crypto";
import {BatchQueries} from "./batch.js";

export const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (value && typeof (value as {toJSON?: unknown}).toJSON == "function") {
    return canonical((value as {toJSON(): unknown}).toJSON());
  }
  if (value && typeof value == "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => compare(a, b))
        .map(([key, item]) => [key, canonical(item)])
    );
  }
  return value;
}

export const identityOf = (value: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");

export async function sharedDocuments<T>(
  batch: BatchQueries | undefined,
  identity: string,
  name: string,
  load: () => Promise<T[]>
) {
  const documents = batch ? await batch.once(`${identity}:${name}`, load) : await load();
  return structuredClone(documents);
}
