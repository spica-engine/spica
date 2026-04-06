import type {ChangeStatus, DiffEntry, EntityChange, ModuleGroup, ParsedDiff} from "../types/version-control";

const MODULE_DISPLAY_NAMES: Record<string, string> = {
  function: "Functions",
  bucket: "Buckets",
  dashboard: "Dashboards",
  storage: "Storage",
  identity: "Identities",
  policy: "Policies",
  webhook: "Webhooks",
  apikey: "API Keys",
};

function normalizeModuleName(raw: string): string {
  return MODULE_DISPLAY_NAMES[raw.toLowerCase()] ?? raw.charAt(0).toUpperCase() + raw.slice(1) + "s";
}

function detectFileStatus(block: string): ChangeStatus {
  if (/^deleted file mode/m.test(block) || /^\+\+\+ \/dev\/null/m.test(block)) {
    return "D";
  }
  if (/^new file mode/m.test(block) || /^--- \/dev\/null/m.test(block)) {
    return "A";
  }
  return "M";
}

function extractEntityName(block: string): string | null {
  const nameMatch = block.match(/^[-+]name:\s*(.+)$/m);
  return nameMatch ? nameMatch[1].trim() : null;
}

function parseFilePath(header: string): {moduleType: string; entityId: string; filePath: string} | null {
  const pathMatch = header.match(/^diff --git a\/(.+?) b\/(.+)/);
  if (!pathMatch) return null;

  const filePath = pathMatch[1];
  const segments = filePath.split("/");
  if (segments.length < 2) return null;

  return {
    moduleType: segments[0],
    entityId: segments[1],
    filePath,
  };
}

function resolveEntityStatus(fileStatuses: ChangeStatus[]): ChangeStatus {
  if (fileStatuses.length === 0) return "M";
  if (fileStatuses.every(s => s === "D")) return "D";
  if (fileStatuses.every(s => s === "A")) return "A";
  return "M";
}

export function parseDiffMessage(message: string): ParsedDiff {
  if (!message || typeof message !== "string") {
    return {modules: []};
  }

  const blocks = message.split(/(?=diff --git )/).filter(b => b.trim().length > 0);

  const entries: (DiffEntry & {blockContent: string})[] = [];

  for (const block of blocks) {
    const firstLine = block.split("\n")[0];
    const parsed = parseFilePath(firstLine);
    if (!parsed) continue;

    entries.push({
      filePath: parsed.filePath,
      moduleType: parsed.moduleType,
      entityId: parsed.entityId,
      fileStatus: detectFileStatus(block),
      blockContent: block,
    });
  }

  const entityMap = new Map<string, {
    moduleType: string;
    entityId: string;
    fileStatuses: ChangeStatus[];
    name: string | null;
  }>();

  for (const entry of entries) {
    const key = `${entry.moduleType}/${entry.entityId}`;
    const existing = entityMap.get(key);

    if (existing) {
      existing.fileStatuses.push(entry.fileStatus);
      // Try to extract name from schema.yaml blocks
      if (!existing.name && entry.filePath.endsWith("schema.yaml")) {
        existing.name = extractEntityName(entry.blockContent);
      }
    } else {
      entityMap.set(key, {
        moduleType: entry.moduleType,
        entityId: entry.entityId,
        fileStatuses: [entry.fileStatus],
        name: entry.filePath.endsWith("schema.yaml")
          ? extractEntityName(entry.blockContent)
          : null,
      });
    }
  }

  const moduleMap = new Map<string, EntityChange[]>();

  for (const entity of entityMap.values()) {
    const displayName = normalizeModuleName(entity.moduleType);
    const items = moduleMap.get(displayName) ?? [];

    items.push({
      id: entity.entityId,
      label: entity.name ?? entity.entityId,
      status: resolveEntityStatus(entity.fileStatuses),
    });

    moduleMap.set(displayName, items);
  }

  const modules: ModuleGroup[] = Array.from(moduleMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([moduleType, items]) => ({
      moduleType,
      items: items.sort((a, b) => a.label.localeCompare(b.label)),
    }));

  return {modules};
}
