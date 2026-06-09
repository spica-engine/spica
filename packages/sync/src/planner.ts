import {bold, cyan, green, red, yellow} from "colorette";
import isEqual from "lodash/isEqual.js";
import {createTwoFilesPatch} from "diff";
import yaml from "yaml";
import {SyncHttpClient} from "./http";
import {SyncReporter, silentReporter} from "./reporter";
import {omit} from "./fs-utils";
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
  http: SyncHttpClient,
  rootDir: string,
  detailed = false,
  detectRenames = true,
  reporter: SyncReporter = silentReporter
): Promise<Plan> {
  const modulePlans: ModulePlan[] = [];

  for (const mod of modules) {
    const [locals, remotes] = await Promise.all([
      reporter.task<LocalResource[]>(`Reading local ${mod.displayName} files`, () =>
        mod.readLocal(rootDir)
      ),
      reporter.task<RemoteResource[]>(`Fetching remote ${mod.displayName}`, () =>
        mod.readRemote(http)
      )
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
            diffs: detailed ? mod.renderDetail(local, remote) : {},
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

    // ── Rename reconciliation ─────────────────────────────────────────────────
    // Only applicable for apply/plan (local → remote direction).
    // In fetch mode, promoting a rename to an update would leave the old local
    // folder on disk while writing the new-named folder — causing duplicates.
    if (detectRenames && mod.extractLocalId) {
      const deleteByRemoteId = new Map(deletes.map(e => [e.remote!.id, e]));
      const remainingCreates: PlanEntry[] = [];
      const promotedRemoteIds = new Set<string>();

      for (const create of creates) {
        const localId = mod.extractLocalId(create.local!.data);
        const matchedDelete = localId ? deleteByRemoteId.get(localId) : undefined;
        if (matchedDelete) {
          promotedRemoteIds.add(matchedDelete.remote!.id);
          const changedFields = mod.diffFields(create.local!.data, matchedDelete.remote!.data);
          updates.push({
            kind: ChangeKind.Update,
            slug: create.slug,
            summary: mod.summaryLine(create.local!),
            changedFields,
            diffs: detailed ? mod.renderDetail(create.local!, matchedDelete.remote!) : {},
            local: create.local,
            remote: matchedDelete.remote
          });
        } else {
          remainingCreates.push(create);
        }
      }

      creates.splice(0, creates.length, ...remainingCreates);
      deletes.splice(
        0,
        deletes.length,
        ...deletes.filter(e => !promotedRemoteIds.has(e.remote!.id))
      );
    }

    modulePlans.push({module: mod, creates, updates, deletes});
  }

  return {modules: modulePlans};
}

export interface RenderOptions {
  detailed?: boolean;
  json?: boolean;
  /**
   * When true, render from the fetch perspective:
   *   plan.deletes (remote-only) → "+" will be written to disk
   *   plan.updates (differ)      → "~" will be overwritten on disk
   *   plan.creates (local-only)  → "-" will be deleted from disk (only when clean is also true)
   */
  fetchMode?: boolean;
  /** When true (fetch --clean), include stale local-only entries in the plan output. */
  clean?: boolean;
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

  if (opts.fetchMode) {
    // Fetch perspective: deletes=new writes, updates=overwrites, creates=stale deletes (only with --clean)
    const toWrite = plan.modules.reduce((n, m) => n + m.deletes.length, 0);
    const toUpdate = plan.modules.reduce((n, m) => n + m.updates.length, 0);
    const toDelete = opts.clean ? plan.modules.reduce((n, m) => n + m.creates.length, 0) : 0;
    const totalChanges = toWrite + toUpdate + toDelete;

    if (totalChanges === 0) {
      console.log(bold(green("\n✓ No changes detected. Local files already match remote.")));
      return;
    }

    for (const mp of plan.modules) {
      const {module: mod, creates, updates, deletes} = mp;
      if (!creates.length && !updates.length && !deletes.length) continue;

      const staleCount = opts.clean ? creates.length : 0;
      console.log(
        `\n${bold(cyan(`── ${mod.displayName.toUpperCase()} ──`))}  ${summaryBadges(deletes.length, updates.length, staleCount)}`
      );

      for (const e of deletes) {
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
      if (opts.clean) {
        for (const e of creates) {
          console.log(`  ${red("-")} ${bold(e.slug)}  ${dim(e.summary)}`);
        }
      }
    }

    console.log(
      `\n${bold("Plan:")}  ${green(`+${toWrite} to write`)}   ${yellow(`~${toUpdate} to update`)}   ${red(`-${toDelete} to delete`)}`
    );

    if (!opts.detailed && toUpdate > 0) {
      console.log(`  ${dim("Run with --detailed to see full diffs.")}`);
    }
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
  reporter?: SyncReporter;
}

export async function applyPlan(
  plan: Plan,
  http: SyncHttpClient,
  opts: ApplyOptions = {}
): Promise<{errors: string[]}> {
  const concurrency = opts.concurrency ?? 10;
  const reporter = opts.reporter ?? silentReporter;
  const errors: string[] = [];

  const handleErr = (label: string, e: unknown) => {
    const msg = formatError(e);
    const full = `${label}: ${msg}`;
    if (opts.abortOnError) throw new Error(full);
    reporter.warn(full);
    errors.push(full);
  };

  for (const mp of plan.modules) {
    const {module: mod, creates, updates, deletes} = mp;

    if (deletes.length) {
      await runConcurrently(
        deletes.map(e => ({slug: e.slug, run: () => mod.delete(http, e.remote!.id)})),
        concurrency,
        `Deleting ${mod.displayName}`,
        handleErr,
        reporter
      );
    }

    if (updates.length) {
      await runConcurrently(
        updates.map(e => ({slug: e.slug, run: () => mod.update(http, e.local!, e.remote!.id)})),
        concurrency,
        `Updating ${mod.displayName}`,
        handleErr,
        reporter
      );
    }

    if (creates.length) {
      await runConcurrently(
        creates.map(e => ({slug: e.slug, run: () => mod.create(http, e.local!)})),
        concurrency,
        `Creating ${mod.displayName}`,
        handleErr,
        reporter
      );
    }
  }

  return {errors};
}

// ─── Fetch: write remote resources to disk ────────────────────────────────────

export interface FetchOptions {
  clean?: boolean;
  concurrency?: number;
  abortOnError?: boolean;
  reporter?: SyncReporter;
}

export async function fetchToDisk(
  plan: Plan,
  http: SyncHttpClient,
  rootDir: string,
  opts: FetchOptions = {}
): Promise<{written: number; deleted: number; errors: string[]}> {
  const concurrency = opts.concurrency ?? 10;
  const reporter = opts.reporter ?? silentReporter;
  const errors: string[] = [];
  let written = 0;
  let deleted = 0;

  const handleErr = (label: string, e: unknown) => {
    const msg = formatError(e);
    const full = `${label}: ${msg}`;
    if (opts.abortOnError) throw new Error(full);
    reporter.warn(full);
    errors.push(full);
  };

  for (const mp of plan.modules) {
    const {module: mod, updates, deletes, creates} = mp;

    // plan.deletes = remote-only (new local files); plan.updates = changed (overwrite)
    const toWrite = [...deletes, ...updates];
    if (toWrite.length) {
      await runConcurrently(
        toWrite.map(e => ({
          slug: e.slug,
          run: async () => {
            await mod.writeLocal(rootDir, e.remote!);
            written++;
          }
        })),
        concurrency,
        `Writing ${mod.displayName}`,
        handleErr,
        reporter
      );
    }

    // plan.creates = local-only (stale) → delete from disk when --clean
    if (opts.clean && creates.length) {
      await runConcurrently(
        creates.map(e => ({
          slug: e.slug,
          run: async () => {
            await mod.deleteLocal(rootDir, e.slug);
            deleted++;
          }
        })),
        concurrency,
        `Deleting ${mod.displayName}`,
        handleErr,
        reporter
      );
    }
  }

  return {written, deleted, errors};
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
export function buildUnifiedDiff(oldContent: string, newContent: string, filename: string): string {
  return createTwoFilesPatch(`remote/${filename}`, `local/${filename}`, oldContent, newContent);
}

/**
 * Render a unified diff for a single-schema resource's `renderDetail` implementation.
 * Shared by the simple schema modules (bucket, env-var, policy, secret).
 */
export function renderSchemaDetail(
  localData: object,
  remoteData: object,
  ignoredFields: string[]
): Record<string, string> {
  const localYaml = yaml.stringify(omit(localData, ignoredFields));
  const remoteYaml = yaml.stringify(omit(remoteData, ignoredFields));
  return {schema: buildUnifiedDiff(remoteYaml, localYaml, "schema.yaml")};
}

async function runConcurrently(
  tasks: Array<{slug: string; run: () => Promise<void>}>,
  concurrency: number,
  label: string,
  onError: (label: string, e: unknown) => void,
  reporter: SyncReporter
): Promise<void> {
  if (!tasks.length) return;

  const total = tasks.length;
  let done = 0;

  // Drive progress through the injected reporter so errors thrown by onError
  // (abortOnError path) propagate to the caller's try/catch. The CLI reporter
  // renders this with ora; the silent default does nothing.
  const progress = reporter.progress(label, total);
  try {
    const limit = Math.max(1, Math.min(total, concurrency));
    let batch: typeof tasks = [];
    for (let i = 0; i < tasks.length; i++) {
      batch.push(tasks[i]);
      if (batch.length === limit || i === tasks.length - 1) {
        await Promise.all(
          batch.map(task =>
            task
              .run()
              .catch((e: unknown) => onError(`${label}: ${task.slug}`, e))
              .finally(() => {
                done++;
                progress.update(task.slug, done, total);
              })
          )
        );
        batch = [];
      }
    }
    progress.succeed();
  } catch (e) {
    progress.fail();
    throw e;
  }
}

function formatError(e: unknown): string {
  if (e && typeof e === "object") {
    const err = e as any;
    return err.message ?? err.data?.message ?? JSON.stringify(e);
  }
  return String(e);
}
