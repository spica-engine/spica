import crypto from "crypto";
import {
  applyPlan,
  buildPlan,
  memorySource,
  Plan,
  PlanEntry,
  resolveModules,
  SyncHttpClient
} from "@spica-server/sync";
import {createHttpClient, SpicaConnection} from "./http";

export type ResourceFiles = Record<string, string> | Map<string, string>;

export interface PlanOptions {
  /** The Spica instance to compare against and apply to. */
  connection: SpicaConnection;
  /** Project files keyed by project-relative path, e.g. from `readTarball`. */
  files: ResourceFiles;
  /** Limit to these modules (bucket, function, policy, env-var, secret). Default: all. */
  modules?: string[];
  /** Maximum parallel API requests. Default 10. */
  concurrency?: number;
  /** Diff sections longer than this many characters are left out of the plan. Default 200000. */
  maxDiffLength?: number;
}

export interface ApplyOptions extends PlanOptions {
  /** The fingerprint of the plan that was reviewed; apply refuses to run a different plan. */
  fingerprint: string;
  /** Stop at the first failing resource instead of applying the rest. Default false. */
  abortOnError?: boolean;
}

export interface SyncPlanEntry {
  slug: string;
  summary: string;
  /** Top-level fields that differ; only set for updates. */
  changedFields: string[];
  /** Unified diffs keyed by section (schema, index, dependencies); only set for updates. */
  diffs: Record<string, string>;
  /** Diff sections left out because they exceed `maxDiffLength`. */
  omittedDiffs: string[];
}

export interface SyncModulePlan {
  module: string;
  displayName: string;
  creates: SyncPlanEntry[];
  updates: SyncPlanEntry[];
  deletes: SyncPlanEntry[];
}

export interface SyncPlan {
  /** Changes whenever the files or the relevant remote state change. */
  fingerprint: string;
  totals: {creates: number; updates: number; deletes: number};
  modules: SyncModulePlan[];
}

export type ApplyResult =
  | {status: "outdated"; plan: SyncPlan}
  | {status: "succeeded" | "partial" | "failed"; plan: SyncPlan; errors: string[]};

const DEFAULT_MAX_DIFF_LENGTH = 200_000;

/** Compares the files with the Spica instance and describes the changes an apply would make. */
export async function plan(options: PlanOptions): Promise<SyncPlan> {
  const {plan} = await build(options, createHttpClient(options.connection));
  return plan;
}

/**
 * Re-plans and applies the changes, provided they are still exactly the ones that were
 * reviewed. When the files or the instance changed in between, nothing is applied and the
 * new plan is returned with status "outdated" so it can be reviewed again.
 */
export async function apply(options: ApplyOptions): Promise<ApplyResult> {
  const http = createHttpClient(options.connection);
  const {plan, raw} = await build(options, http);
  if (plan.fingerprint !== options.fingerprint) {
    return {status: "outdated", plan};
  }

  const total = plan.totals.creates + plan.totals.updates + plan.totals.deletes;
  const {errors} = await applyPlan(raw, http, {
    concurrency: options.concurrency,
    abortOnError: options.abortOnError
  });

  const status = errors.length === 0 ? "succeeded" : errors.length < total ? "partial" : "failed";
  return {status, plan, errors};
}

async function build(options: PlanOptions, http: SyncHttpClient) {
  const raw = await buildPlan(resolveModules(options.modules), http, "", {
    detailed: true,
    concurrency: options.concurrency,
    source: memorySource(options.files)
  });
  return {raw, plan: summarize(raw, options.maxDiffLength ?? DEFAULT_MAX_DIFF_LENGTH)};
}

function summarize(raw: Plan, maxDiffLength: number): SyncPlan {
  const toEntry = (entry: PlanEntry): SyncPlanEntry => {
    const diffs: Record<string, string> = {};
    const omittedDiffs: string[] = [];
    for (const [section, diff] of Object.entries(entry.diffs)) {
      if (diff.length > maxDiffLength) omittedDiffs.push(section);
      else diffs[section] = diff;
    }
    return {
      slug: entry.slug,
      summary: entry.summary,
      changedFields: entry.changedFields,
      diffs,
      omittedDiffs
    };
  };

  const modules = raw.modules.map(mp => ({
    module: mp.module.name,
    displayName: mp.module.displayName,
    creates: mp.creates.map(toEntry),
    updates: mp.updates.map(toEntry),
    deletes: mp.deletes.map(toEntry)
  }));

  const sum = (key: "creates" | "updates" | "deletes") =>
    raw.modules.reduce((n, mp) => n + mp[key].length, 0);

  return {
    fingerprint: fingerprint(raw),
    totals: {creates: sum("creates"), updates: sum("updates"), deletes: sum("deletes")},
    modules
  };
}

function fingerprint(raw: Plan): string {
  const entries = raw.modules.flatMap(mp =>
    [...mp.creates, ...mp.updates, ...mp.deletes].map(entry => [
      mp.module.name,
      entry.kind,
      entry.slug,
      entry.remote?.id ?? null,
      digest(entry.local?.data),
      digest(entry.remote?.data)
    ])
  );
  entries.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return digest(entries);
}

function digest(value: unknown): string {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value as object)
    .filter(key => (value as Record<string, unknown>)[key] !== undefined)
    .sort();
  return `{${keys
    .map(
      key => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`
    )
    .join(",")}}`;
}
