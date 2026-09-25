import fs from "node:fs";

/**
 * Where `readLocal` reads project files from. The CLI reads the working tree on
 * disk; programmatic callers (e.g. a server syncing a git commit) hand over the
 * files they already hold in memory.
 */
export interface ResourceSource {
  /** Immediate child folder names of `dir`; [] when it does not exist. */
  listFolders(dir: string): string[];
  /** File contents, or null when the file does not exist. */
  readText(filePath: string): string | null;
}

export const diskSource: ResourceSource = {
  listFolders(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir, {withFileTypes: true})
      .filter(d => d.isDirectory())
      .map(d => d.name);
  },
  readText(filePath) {
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, "utf-8");
  }
};

function normalizePath(p: string): string {
  return p
    .replace(/\\/g, "/")
    .split("/")
    .filter(segment => segment && segment !== ".")
    .join("/");
}

/**
 * A source over an in-memory file map keyed by project-relative paths
 * (e.g. `bucket/Users/schema.yaml`). Pass `""` as the `rootDir` when reading.
 */
export function memorySource(files: Record<string, string> | Map<string, string>): ResourceSource {
  const byPath = new Map<string, string>();
  const entries = files instanceof Map ? files.entries() : Object.entries(files);
  for (const [filePath, content] of entries) {
    byPath.set(normalizePath(filePath), content);
  }

  return {
    listFolders(dir) {
      const prefix = normalizePath(dir);
      const folders = new Set<string>();
      for (const filePath of byPath.keys()) {
        if (prefix && !filePath.startsWith(`${prefix}/`)) continue;
        const rest = prefix ? filePath.slice(prefix.length + 1) : filePath;
        const slash = rest.indexOf("/");
        if (slash > 0) folders.add(rest.slice(0, slash));
      }
      return [...folders];
    },
    readText(filePath) {
      return byPath.get(normalizePath(filePath)) ?? null;
    }
  };
}
