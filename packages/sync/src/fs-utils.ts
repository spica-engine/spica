import fs from "fs";
import path from "path";
import yaml from "yaml";
import {LocalResource} from "./types";

/** Ensure a directory exists, creating it recursively if needed. */
export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, {recursive: true});
}

/** List immediate child folder names inside a directory. Returns [] if dir doesn't exist. */
export function listFolders(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, {withFileTypes: true})
    .filter(d => d.isDirectory())
    .map(d => d.name);
}

/** Read and parse a YAML file. Returns null if not found. */
export function readYaml<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return yaml.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

/** Write an object as YAML to filePath, creating parent dirs as needed. */
export function writeYaml(filePath: string, data: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, yaml.stringify(data), "utf-8");
}

/** Read a text file, returning null if not found. */
export function readText(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf-8");
}

/** Write text content to filePath, creating parent dirs as needed. */
export function writeText(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf-8");
}

/** Remove a directory and everything inside it. No-op if not found. */
export function removeDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, {recursive: true, force: true});
  }
}

/** Deep-clone an object and delete the given field names. */
export function omit<T extends object>(obj: T, fields: string[]): Omit<T, string> {
  const clone = structuredClone(obj) as any;
  for (const f of fields) delete clone[f];
  return clone;
}

/**
 * Sanitize a remote-supplied slug so it cannot escape the project directory.
 * Uses path.basename to strip any directory components (e.g. "../../.ssh/authorized_keys"
 * becomes "authorized_keys").
 */
export function sanitizeSlug(slug: string): string {
  return path.basename(path.normalize(slug));
}

/**
 * Unwrap a list response that may be paginated ({ data: T[] }) or a plain array (T[]).
 * Use this defensively whenever the API might paginate.
 */
export function unwrapList<T>(res: T[] | {data: T[]}): T[] {
  if (Array.isArray(res)) return res;
  return (res as {data: T[]}).data ?? [];
}

/**
 * Read all schema-only resources for a module from disk.
 * Each resource lives at `<rootDir>/<moduleName>/<slug>/schema.yaml`.
 * Shared by the simple schema modules (bucket, env-var, policy, secret).
 */
export async function readLocalSchemas<T>(
  rootDir: string,
  moduleName: string
): Promise<LocalResource<T>[]> {
  const dir = path.join(rootDir, moduleName);
  const slugs = listFolders(dir);
  const results: LocalResource<T>[] = [];
  for (const slug of slugs) {
    const data = readYaml<T>(path.join(dir, slug, "schema.yaml"));
    if (data) results.push({slug, data});
  }
  return results;
}
