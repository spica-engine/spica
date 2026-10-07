import fs from "fs";
import path from "path";
import * as tar from "tar";
import {pathExists} from "./fs-utils.js";

export async function packDirectory(dir: string, entries: string[], file: string): Promise<void> {
  const present: string[] = [];
  for (const entry of entries) {
    if (await pathExists(path.join(dir, entry))) present.push(entry);
  }
  await tar.c({gzip: true, cwd: dir, file, portable: true}, present);
}

export function unpackArchive(file: string, dir: string): Promise<void> {
  return tar.x({file, cwd: dir, preservePaths: true, filter: safeEntryFilter()});
}

function escapes(entryPath: string): boolean {
  const normalized = path.posix.normalize(entryPath);
  return path.posix.isAbsolute(normalized) || normalized.split("/").includes("..");
}

// preservePaths is required because node_modules holds symlinks that point outside the function
// directory (@spica-fn/* -> ../../../<sibling>, legacy .build/node_modules -> absolute path), but it
// also disables tar's own path checks. This filter restores them for everything except symlink
// targets: no absolute or parent-relative entry paths, no escaping hardlinks, and no entries
// written through a symlink extracted earlier from the same archive.
function safeEntryFilter() {
  const symlinks = new Set<string>();
  return (entryPath: string, entry: tar.ReadEntry | fs.Stats) => {
    if (!("type" in entry)) return false;
    const normalized = path.posix.normalize(entryPath).replace(/\/$/, "");
    if (escapes(normalized)) return false;
    if (entry.type == "Link" && escapes(entry.linkpath ?? "")) return false;
    const segments = normalized.split("/");
    for (let i = 1; i < segments.length; i++) {
      if (symlinks.has(segments.slice(0, i).join("/"))) return false;
    }
    if (entry.type == "SymbolicLink") symlinks.add(normalized);
    return true;
  };
}
