import path from "path";
import fs from "fs";
import chokidar from "chokidar";
import {ActionParameters, Command, Program} from "@caporal/core";
import {bold, cyan, green, red, yellow} from "colorette";
import ora from "ora";
import {httpService} from "../../http";
import {context} from "../../context";
import {buildPlan, applyPlan, renderPlan} from "./planner";
import {confirm} from "./prompt";
import {resolveModules, MODULE_NAMES} from "./modules/index";
import {readYaml} from "./fs-utils";
import {DevEventContext, ResourceModule, LocalResource} from "./types";

// ─── State ───────────────────────────────────────────────────────────────────

export interface DevState {
  /** moduleName → (slug → remoteId) */
  remoteIds: Map<string, Map<string, string>>;
}

function createEmptyState(): DevState {
  return {remoteIds: new Map()};
}

async function refreshStateForModule(
  mod: ResourceModule,
  http: httpService.Client,
  state: DevState,
  rootDir: string
): Promise<void> {
  try {
    const [locals, remotes] = await Promise.all([mod.readLocal(rootDir), mod.readRemote(http)]);
    const map = new Map<string, string>();
    const remoteBySlug = new Map(remotes.map(r => [r.slug, r]));
    for (const local of locals) {
      // 1. Exact slug match (dir name === sanitizeSlug(identityField))
      const bySlug = remoteBySlug.get(local.slug);
      if (bySlug) {
        map.set(local.slug, bySlug.id);
        continue;
      }
      // 2. Fallback: match by identity field value (handles user-chosen dir names)
      const localIdentity = (local.data as Record<string, unknown>)[mod.identityField];
      const matched = remotes.find(
        r => (r.data as Record<string, unknown>)[mod.identityField] === localIdentity
      );
      if (matched) map.set(local.slug, matched.id);
    }
    state.remoteIds.set(mod.name, map);
  } catch {
    // Best-effort; watcher continues
  }
}

// ─── Globs ───────────────────────────────────────────────────────────────────

function buildWatchIgnored(modules: ResourceModule[], rootDir: string) {
  // Build a per-module set of watched filenames for fast lookup
  const watchedByModule = new Map(
    modules.map(m => [m.name, new Set(m.watchedFiles ?? ["schema.yaml"])])
  );
  return (filePath: string, stats?: fs.Stats) => {
    const rel = path.relative(rootDir, filePath);
    const parts = rel.split(path.sep);
    if (stats?.isDirectory()) {
      // Only recurse into <module>/ and <module>/<slug>/ — ignore deeper dirs
      return parts.length >= 3;
    }
    if (!stats) return false;
    // Ignore files outside <moduleName>/<slug>/<file> depth
    if (parts.length !== 3) return true;
    const [moduleName, , file] = parts;
    const watched = watchedByModule.get(moduleName);
    if (!watched) return true;
    return !watched.has(file);
  };
}

/**
 * Read a single-resource local state for schema-only modules (bucket, env-var, secret, policy).
 */
function readLocalSchema<T>(
  mod: ResourceModule<T>,
  rootDir: string,
  slug: string
): LocalResource<T> | null {
  const schemaPath = path.join(rootDir, mod.name, slug, "schema.yaml");
  const data = readYaml<T>(schemaPath);
  if (!data) return null;
  return {slug, data};
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

export interface DevDispatcherOptions {
  modules: ResourceModule[];
  http: httpService.Client;
  rootDir: string;
  state: DevState;
  /** Override for testing — called instead of console.log */
  logger?: (msg: string) => void;
  /** Override for testing — called instead of console.warn */
  warnLogger?: (msg: string) => void;
  /** How long (ms) to wait for rename partner after an unlink (default 500) */
  renameWindowMs?: number;
}

export interface DevDispatcher {
  handleEvent(type: "add" | "change" | "unlink", absolutePath: string): Promise<void>;
  /** Drain all pending timers (for testing) */
  dispose(): void;
}

export function createDevDispatcher(opts: DevDispatcherOptions): DevDispatcher {
  const {modules, http, rootDir, state, renameWindowMs = 500} = opts;
  const log = opts.logger ?? ((m: string) => console.log(m));
  const warn = opts.warnLogger ?? ((m: string) => console.warn(m));

  const moduleMap = new Map(modules.map(m => [m.name, m]));

  /**
   * pendingDeletes: key = `${moduleName}:${slug}`
   * Each entry holds the timer handle and enough info to promote into an update.
   */
  const pendingDeletes = new Map<
    string,
    {timer: ReturnType<typeof setTimeout>; moduleName: string; slug: string; remoteId: string}
  >();

  /**
   * Return a promise that resolves after `ms` milliseconds.
   * Exported via opts so tests can override with fake timers.
   */
  const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

  // ── helpers ────────────────────────────────────────────────────────────────

  function parseFilePath(absolutePath: string): {moduleName: string; slug: string; file: string} | null {
    const rel = path.relative(rootDir, absolutePath);
    const parts = rel.split(path.sep);
    if (parts.length < 3) return null;
    const [moduleName, slug, ...rest] = parts;
    return {moduleName, slug, file: rest.join(path.sep)};
  }

  function getRemoteId(moduleName: string, slug: string): string | undefined {
    return state.remoteIds.get(moduleName)?.get(slug);
  }

  function setRemoteId(moduleName: string, slug: string, id: string): void {
    if (!state.remoteIds.has(moduleName)) state.remoteIds.set(moduleName, new Map());
    state.remoteIds.get(moduleName)!.set(slug, id);
  }

  function clearRemoteId(moduleName: string, slug: string): void {
    state.remoteIds.get(moduleName)?.delete(slug);
  }

  // ── spinOp — shared spinner wrapper ───────────────────────────────────────

  async function spinOp(
    label: string,
    successText: string,
    op: () => Promise<void>
  ): Promise<void> {
    const spinner = ora({text: `${label}  Applying…`, color: "yellow"}).start();
    try {
      await op();
      spinner.succeed(`${label}  ${successText}`);
    } catch (err) {
      spinner.fail(`${label}  failed: ${formatError(err)}`);
    }
  }

  // ── schema-module handler (bucket / env-var / secret / policy) ─────────────

  async function handleSchemaAdd(mod: ResourceModule, slug: string): Promise<void> {
    const local = readLocalSchema(mod, rootDir, slug);
    if (!local) return;

    const newLocalId = mod.extractLocalId?.(local.data);
    let promotedKey: string | undefined;
    if (newLocalId) {
      for (const [key, pending] of pendingDeletes) {
        if (pending.moduleName === mod.name && pending.remoteId === newLocalId) {
          promotedKey = key;
          break;
        }
      }
    }

    if (promotedKey) {
      const pending = pendingDeletes.get(promotedKey)!;
      clearTimeout(pending.timer);
      pendingDeletes.delete(promotedKey);
      clearRemoteId(mod.name, pending.slug);
      setRemoteId(mod.name, slug, pending.remoteId);
      const renameLabel = `${yellow("~")}  ${bold(mod.displayName)}  ${bold(pending.slug)} ${cyan("→")} ${bold(slug)}`;
      await spinOp(renameLabel, "updated (rename)", () => mod.update(http, local, pending.remoteId));
      return;
    }

    const remoteId = getRemoteId(mod.name, slug);
    if (remoteId) {
      await spinOp(
        `${yellow("~")}  ${bold(mod.displayName)}  ${bold(slug)}`,
        "updated",
        () => mod.update(http, local, remoteId)
      );
    } else {
      await spinOp(
        `${green("+")}  ${bold(mod.displayName)}  ${bold(slug)}`,
        "created",
        async () => {
          await mod.create(http, local);
          await refreshStateForModule(mod, http, state, rootDir);
        }
      );
    }
  }

  async function handleSchemaChange(mod: ResourceModule, slug: string): Promise<void> {
    const local = readLocalSchema(mod, rootDir, slug);
    if (!local) return;
    const remoteId = getRemoteId(mod.name, slug);
    if (!remoteId) return handleSchemaAdd(mod, slug);
    await spinOp(
      `${yellow("~")}  ${bold(mod.displayName)}  ${bold(slug)}`,
      "updated",
      () => mod.update(http, local, remoteId)
    );
  }

  async function handleSchemaUnlink(mod: ResourceModule, slug: string): Promise<void> {
    const remoteId = getRemoteId(mod.name, slug);
    if (!remoteId) return;

    const pendingKey = `${mod.name}:${slug}`;
    if (pendingDeletes.has(pendingKey)) return;

    const timer = setTimeout(async () => {
      pendingDeletes.delete(pendingKey);
      clearRemoteId(mod.name, slug);
      await spinOp(
        `${red("-")}  ${bold(mod.displayName)}  ${bold(slug)}`,
        "deleted",
        () => mod.delete(http, remoteId)
      );
    }, renameWindowMs);

    pendingDeletes.set(pendingKey, {timer, moduleName: mod.name, slug, remoteId});
  }

  // ── DevEventContext factory ────────────────────────────────────────────────

  function makeContext(
    mod: ResourceModule,
    type: "add" | "change" | "unlink",
    slug: string,
    file: string
  ): DevEventContext {
    return {
      type,
      slug,
      file,
      http,
      rootDir,
      getRemoteId: (s) => getRemoteId(mod.name, s),
      setRemoteId: (s, id) => setRemoteId(mod.name, s, id),
      clearRemoteId: (s) => clearRemoteId(mod.name, s),
      schedulePendingDelete(s, remoteId) {
        const pendingKey = `${mod.name}:${s}`;
        if (pendingDeletes.has(pendingKey)) return;
        const timer = setTimeout(async () => {
          pendingDeletes.delete(pendingKey);
          clearRemoteId(mod.name, s);
          await spinOp(
            `${red("-")}  ${bold(mod.displayName)}  ${bold(s)}`,
            "deleted",
            () => mod.delete(http, remoteId)
          );
        }, renameWindowMs);
        pendingDeletes.set(pendingKey, {timer, moduleName: mod.name, slug: s, remoteId});
      },
      consumePendingDeleteByRemoteId(remoteId) {
        for (const [key, pending] of pendingDeletes) {
          if (pending.moduleName === mod.name && pending.remoteId === remoteId) {
            clearTimeout(pending.timer);
            pendingDeletes.delete(key);
            return {slug: pending.slug, remoteId: pending.remoteId};
          }
        }
        return undefined;
      },
      sleep,
      refreshState: () => refreshStateForModule(mod, http, state, rootDir),
      log,
      warn,
      spin: (label, successText, op) => spinOp(label, successText, op)
    };
  }

  // ── main dispatcher ────────────────────────────────────────────────────────

  async function handleEvent(type: "add" | "change" | "unlink", absolutePath: string): Promise<void> {
    const parsed = parseFilePath(absolutePath);
    if (!parsed) return;

    const {moduleName, slug, file} = parsed;
    const mod = moduleMap.get(moduleName);
    if (!mod) return;

    if (mod.devHandleEvent) {
      // Module provides its own full event handler
      await mod.devHandleEvent(makeContext(mod, type, slug, file));
    } else {
      // Default schema-only handler (bucket / env-var / secret / policy)
      if (file !== "schema.yaml") return;
      if (type === "add") {
        await handleSchemaAdd(mod, slug);
      } else if (type === "change") {
        await handleSchemaChange(mod, slug);
      } else if (type === "unlink") {
        await handleSchemaUnlink(mod, slug);
      }
    }
  }

  function dispose(): void {
    for (const pending of pendingDeletes.values()) {
      clearTimeout(pending.timer);
    }
    pendingDeletes.clear();
  }

  return {handleEvent, dispose};
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function formatError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as any).message);
  return String(e);
}

// ─── Command ─────────────────────────────────────────────────────────────────

async function dev({args, options}: ActionParameters) {
  const rootDir = path.resolve((args.dir as string | undefined) ?? process.cwd());
  const moduleFilter = options.module
    ? (Array.isArray(options.module) ? options.module : [options.module]).map(String)
    : undefined;

  const modules = resolveModules(moduleFilter);

  // Warn if context URL is HTTPS (this command is designed for local dev)
  let ctx: {url: string; authorization: string};
  try {
    ctx = await context.getCurrent();
  } catch (err) {
    console.log(`\n${bold(red(`✗ ${formatError(err)}`))}`)
    process.exitCode = 1;
    return;
  }

  if (ctx.url.startsWith("https://")) {
    console.log(
      bold(yellow("\n⚠  Warning: The current context is using HTTPS.\n")) +
        `   ${bold("sync dev")} is designed for development. ` +
        `Using it against a remote instance may have unintended side-effects.\n` +
        `   Tip: Start a local instance with ${bold("spica project start")} and switch to it ` +
        `with ${bold("spica context switch <name>")} before running ${bold("sync dev")}.`
    );
  }

  const http = httpService.create({
    baseUrl: ctx.url,
    authorization: ctx.authorization
  });

  // ── First sync ────────────────────────────────────────────────────────────
  console.log(bold("\nBuilding plan…"));
  let plan: Awaited<ReturnType<typeof buildPlan>>;
  try {
    plan = await buildPlan(modules, http, rootDir, false);
  } catch (err) {
    console.log(`\n${bold(red(`✗ Failed to build plan: ${formatError(err)}`))}`)
    process.exitCode = 1;
    return;
  }

  const totalChanges = plan.modules.reduce(
    (n, m) => n + m.creates.length + m.updates.length + m.deletes.length,
    0
  );

  renderPlan(plan, {detailed: false});

  if (totalChanges > 0) {
    const ok = await confirm("\nApply these changes?");
    if (!ok) {
      console.log(bold(yellow("Aborted. No changes were applied.")));
      process.exitCode = 1;
      return;
    }

    console.log(bold("\nApplying changes…"));
    try {
      const {errors} = await applyPlan(plan, http, {concurrency: 5, abortOnError: true});
      if (errors.length) {
        // abortOnError=true means applyPlan threw before we get here, but guard anyway
        console.log(bold(red(`\n✗ Apply failed with ${errors.length} error(s).`)));
        process.exitCode = 1;
        return;
      }
    } catch (err) {
      console.log(`\n${bold(red(`✗ ${formatError(err)}`))}`)
      process.exitCode = 1;
      return;
    }

    const c = plan.modules.reduce((n, m) => n + m.creates.length, 0);
    const u = plan.modules.reduce((n, m) => n + m.updates.length, 0);
    const d = plan.modules.reduce((n, m) => n + m.deletes.length, 0);
    console.log(
      bold(green(`\n✓ Initial sync completed.`)) +
        `  ${green(`+${c} created`)}  ${yellow(`~${u} updated`)}  ${red(`-${d} deleted`)}`
    );
  } else {
    console.log(bold(green("\n✓ Already in sync. Starting watcher…")));
  }

  // ── Build initial remote state ────────────────────────────────────────────
  const state = createEmptyState();
  await Promise.all(modules.map(mod => refreshStateForModule(mod, http, state, rootDir)));

  // ── Start watcher ─────────────────────────────────────────────────────────
  const watchDirs = modules.map(mod => path.join(rootDir, mod.name));
  const dispatcher = createDevDispatcher({modules, http, rootDir, state});

  console.log(
    bold(`\n${cyan("👁")}  Watching for changes in ${bold(rootDir)}…`) +
      `  ${bold(yellow("(Ctrl-C to stop)"))}`
  );

  const watcher = chokidar.watch(watchDirs, {
    ignoreInitial: true,
    persistent: true,
    ignored: buildWatchIgnored(modules, rootDir),
    awaitWriteFinish: {stabilityThreshold: 200, pollInterval: 50}
  });

  watcher.on("add", (p: string) => dispatcher.handleEvent("add", p));
  watcher.on("change", (p: string) => dispatcher.handleEvent("change", p));
  watcher.on("unlink", (p: string) => dispatcher.handleEvent("unlink", p));
  watcher.on("error", (err: unknown) =>
    console.warn(bold(yellow(`\n⚠  Watcher error: ${formatError(err)}`)))
  );

  const shutdown = () => {
    console.log(bold("\nStopping watcher…"));
    dispatcher.dispose();
    watcher.close().then(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

export default function (program: Program): Command {
  return program
    .command(
      "dev",
      "Watch local project files and automatically sync changes to the connected Spica instance."
    )
    .argument("[dir]", "Project directory (default: current working directory)")
    .option(
      "--module <name>",
      `Filter to specific module(s). Available: ${MODULE_NAMES.join(", ")}.`,
      {
        validator: MODULE_NAMES
      }
    )
    .action(dev);
}
