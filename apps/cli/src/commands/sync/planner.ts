import {bold, cyan, green, red, yellow} from "colorette";
import isEqual from "lodash/isEqual.js";
import {createTwoFilesPatch} from "diff";
import {spin} from "../../console";
import {httpService} from "../../http";
import {
  ChangeKind,
  LocalResource,
  ModulePlan,
  Plan,
  PlanEntry,
  RemoteResource,
  ResourceModule
} from "./types";

// ─── Build ────────────────────────────────────────────────────────────────────

export async function buildPlan(
  modules: ResourceModule[],
  http: httpService.Client,
  rootDir: string
): Promise<Plan> {
  const modulePlans: ModulePlan[] = [];

  for (const mod of modules) {
    const [locals, remotes] = await Promise.all([
      spin<LocalResource[]>({
        text: `Reading local ${mod.displayName} files`,
        op: () => mod.readLocal(rootDir)
      }),
      spin<RemoteResource[]>({
        text: `Fetching remote ${mod.displayName}`,
        op: () => mod.readRemote(http)
      })
    ]);

    const localBySlug = new Map(locals.map(l => [l.slug, l]));
    const remoteBySlug = new Map(remotes.map(r => [r.slug, r]));

    const creates: PlanEntry[] = [];
    const updates: PlanEntry[] = [];
    const deletes: PlanEntry[] = [];

    for (const local of locals) {
      const remote = remoteBySlug.get(local.slug);
      if (!remote) {
        creates.push({
          kind: ChangeKind.Create,
          slug: local.slug,
          summary: mod.summaryLine(local),
          changedFields: [],
          diffs: {},
          local,
          remote: undefined
        });
      } else {
        const changedFields = mod.diffFields(local.data, remote.data);
        if (changedFields.length > 0) {
          updates.push({
            kind: ChangeKind.Update,
            slug: local.slug,
            summary: mod.summaryLine(local),
            changedFields,
            diffs: mod.renderDetail(local, remote),
            local,
            remote
          });
        }
      }
    }

    for (const remote of remotes) {
      if (!localBySlug.has(remote.slug)) {
        deletes.push({
          kind: ChangeKind.Delete,
          slug: remote.slug,
          summary: mod.summaryLine(remote),
          changedFields: [],
          diffs: {},
          local: undefined,
          remote
        });
      }
    }

    modulePlans.push({module: mod, creates, updates, deletes});
  }

  return {modules: modulePlans};
}

// ─── Render ───────────────────────────────────────────────────────────────────

export interface RenderOptions {
  detailed?: boolean;
  json?: boolean;
}

export function renderPlan(plan: Plan, opts: RenderOptions = {}): void {
  if (opts.json) {
    const output = plan.modules.map(mp => ({
      module: mp.module.name,
      creates: mp.creates.map(e => ({slug: e.slug, summary: e.summary})),
      updates: mp.updates.map(e => ({
        slug: e.slug,
        summary: e.summary,
        changedFields: e.changedFields
      })),
      deletes: mp.deletes.map(e => ({slug: e.slug, summary: e.summary}))
    }));
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  const totalCreates = plan.modules.reduce((n, m) => n + m.creates.length, 0);
  const totalUpdates = plan.modules.reduce((n, m) => n + m.updates.length, 0);
  const totalDeletes = plan.modules.reduce((n, m) => n + m.deletes.length, 0);
  const totalChanges = totalCreates + totalUpdates + totalDeletes;

  if (totalChanges === 0) {
    console.log(bold(green("\n✓ No changes detected. Local state matches remote.")));
    return;
  }

  for (const mp of plan.modules) {
    const {module: mod, creates, updates, deletes} = mp;
    if (!creates.length && !updates.length && !deletes.length) continue;

    console.log(
      `\n${bold(cyan(`── ${mod.displayName.toUpperCase()} ──`))}  ${summaryBadges(creates.length, updates.length, deletes.length)}`
    );

    for (const e of creates) {
      console.log(`  ${green("+")} ${bold(e.slug)}  ${dim(e.summary)}`);
    }
    for (const e of updates) {
      console.log(
        `  ${yellow("~")} ${bold(e.slug)}  ${dim(e.summary)}  ${yellow(`[${e.changedFields.join(", ")}]`)}`
      );
      if (opts.detailed) {
        for (const [section, diff] of Object.entries(e.diffs)) {
          if (!diff) continue;
          console.log(`      ${bold(section)}:`);
          renderUnifiedDiff(diff);
        }
      }
    }
    for (const e of deletes) {
      console.log(`  ${red("-")} ${bold(e.slug)}  ${dim(e.summary)}`);
    }
  }

  console.log(
    `\n${bold("Plan:")}  ${green(`+${totalCreates} to create`)}   ${yellow(`~${totalUpdates} to update`)}   ${red(`-${totalDeletes} to delete`)}`
  );

  if (!opts.detailed && totalUpdates > 0) {
    console.log(`  ${dim("Run with --detailed to see full diffs.")}`);
  }
}

function summaryBadges(c: number, u: number, d: number): string {
  const parts: string[] = [];
  if (c) parts.push(green(`+${c}`));
  if (u) parts.push(yellow(`~${u}`));
  if (d) parts.push(red(`-${d}`));
  return parts.join("  ");
}

function dim(s: string): string {
  return `\x1b[2m${s}\x1b[0m`;
}

function renderUnifiedDiff(diff: string): void {
  for (const line of diff.split("\n")) {
    if (line.startsWith("+")) {
      process.stdout.write(green("      " + line) + "\n");
    } else if (line.startsWith("-")) {
      process.stdout.write(red("      " + line) + "\n");
    } else {
      process.stdout.write(dim("      " + line) + "\n");
    }
  }
}

// ─── Apply ────────────────────────────────────────────────────────────────────

export interface ApplyOptions {
  concurrency?: number;
  abortOnError?: boolean;
}

export async function applyPlan(
  plan: Plan,
  http: httpService.Client,
  opts: ApplyOptions = {}
): Promise<{errors: string[]}> {
  const concurrency = opts.concurrency ?? 10;
  const errors: string[] = [];

  const handleErr = (label: string, e: unknown) => {
    const msg = formatError(e);
    const full = `${label}: ${msg}`;
    if (opts.abortOnError) throw new Error(full);
    console.warn(bold(yellow(`  ⚠  ${full}`)));
    errors.push(full);
  };

  for (const mp of plan.modules) {
    const {module: mod, creates, updates, deletes} = mp;

    if (deletes.length) {
      await runConcurrently(
        deletes.map(e => () => mod.delete(http, e.remote!.id)),
        concurrency,
        `Deleting ${mod.displayName}`,
        handleErr
      );
    }

    if (updates.length) {
      await runConcurrently(
        updates.map(e => () => mod.update(http, e.local!, e.remote!.id)),
        concurrency,
        `Updating ${mod.displayName}`,
        handleErr
      );
    }

    if (creates.length) {
      await runConcurrently(
        creates.map(e => () => mod.create(http, e.local!)),
        concurrency,
        `Creating ${mod.displayName}`,
        handleErr
      );
    }
  }

  return {errors};
}

// ─── Fetch: write remote resources to disk ────────────────────────────────────

export interface FetchOptions {
  clean?: boolean;
}

export async function fetchToDisk(
  modules: ResourceModule[],
  http: httpService.Client,
  rootDir: string,
  opts: FetchOptions = {}
): Promise<{written: number; deleted: number}> {
  let written = 0;
  let deleted = 0;

  for (const mod of modules) {
    const [locals, remotes] = await Promise.all([
      spin<LocalResource[]>({
        text: `Reading local ${mod.displayName} files`,
        op: () => mod.readLocal(rootDir)
      }),
      spin<RemoteResource[]>({
        text: `Fetching remote ${mod.displayName}`,
        op: () => mod.readRemote(http)
      })
    ]);

    const remoteSlugs = new Set(remotes.map(r => r.slug));

    for (const remote of remotes) {
      await mod.writeLocal(rootDir, remote);
      written++;
    }

    if (opts.clean) {
      for (const local of locals) {
        if (!remoteSlugs.has(local.slug)) {
          await mod.deleteLocal(rootDir, local.slug);
          deleted++;
        }
      }
    }
  }

  return {written, deleted};
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

/**
 * Compute diffed field names between two plain objects,
 * excluding ignoredFields from comparison.
 */
export function diffObjectFields(
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
  ignoredFields: string[]
): string[] {
  const allKeys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  const changed: string[] = [];
  for (const key of allKeys) {
    if (ignoredFields.includes(key)) continue;
    if (!isEqual(local[key], remote[key])) {
      changed.push(key);
    }
  }
  return changed;
}

/**
 * Build a unified diff string between two text representations.
 */
export function buildUnifiedDiff(
  oldContent: string,
  newContent: string,
  filename: string
): string {
  return createTwoFilesPatch(`remote/${filename}`, `local/${filename}`, oldContent, newContent);
}

async function runConcurrently(
  tasks: (() => Promise<void>)[],
  concurrency: number,
  label: string,
  onError: (label: string, e: unknown) => void
): Promise<void> {
  if (!tasks.length) return;

  await spin({
    text: label,
    op: async () => {
      const limit = Math.min(tasks.length, concurrency);
      let batch: (() => Promise<void>)[] = [];
      for (let i = 0; i < tasks.length; i++) {
        batch.push(tasks[i]);
        if (batch.length === limit || i === tasks.length - 1) {
          await Promise.all(
            batch.map(t =>
              t().catch((e: unknown) => {
                onError(label, e);
              })
            )
          );
          batch = [];
        }
      }
    }
  });
}

function formatError(e: unknown): string {
  if (e && typeof e === "object") {
    const err = e as any;
    return err.message ?? err.data?.message ?? JSON.stringify(e);
  }
  return String(e);
}
