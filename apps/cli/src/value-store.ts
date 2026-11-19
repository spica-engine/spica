import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import {
  chain,
  fromEnv,
  fromMap,
  resolveModules,
  ResourceModule,
  ValueHandler,
  withValues
} from "@spica-server/sync";
import {config} from "./config";

const VALUES_DIR = ".spica";
const BARE_VALUE = /^[\w@%+=:,./-]*$/;

export function valuesFilePath(rootDir: string, contextName: string): string {
  return path.join(rootDir, VALUES_DIR, `${contextName}.env`);
}

export function readValuesFile(filePath: string): Record<string, string> {
  return fs.existsSync(filePath) ? dotenv.parse(fs.readFileSync(filePath)) : {};
}

export function formatEntry(key: string, value: string): string {
  return `${key}=${quote(value)}`;
}

function escapeLineBreaks(value: string): string {
  return value.replace(/\r/g, String.raw`\r`).replace(/\n/g, String.raw`\n`);
}

function quote(value: string): string {
  if (BARE_VALUE.test(value)) return value;
  if (!/['\r\n]/.test(value)) return `'${value}'`;
  if (!/["\\]/.test(value)) return `"${escapeLineBreaks(value)}"`;
  throw new Error("Values mixing quotes or backslashes with line breaks are not supported.");
}

function entryKey(line: string): string | undefined {
  return /^\s*(?:export\s+)?([\w.-]+)\s*=/.exec(line)?.[1];
}

function readLines(filePath: string): string[] {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf-8")
    .split("\n")
    .filter((line, i, all) => line || i < all.length - 1);
}

export function upsertEntry(filePath: string, key: string, value: string): void {
  const lines = readLines(filePath);
  const entry = formatEntry(key, value);
  const index = lines.findIndex(line => entryKey(line) === key);

  if (index === -1) lines.push(entry);
  else lines[index] = entry;

  fs.mkdirSync(path.dirname(filePath), {recursive: true});
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, {mode: 0o600});
}

export async function loadValueResolver(rootDir: string): Promise<ValueHandler> {
  const {context} = await config.get();
  return chain(fromEnv(process.env), fromMap(readValuesFile(valuesFilePath(rootDir, context))));
}

export async function resolveSyncModules(
  names: string[] | undefined,
  rootDir: string
): Promise<ResourceModule[]> {
  return withValues(resolveModules(names), await loadValueResolver(rootDir));
}
