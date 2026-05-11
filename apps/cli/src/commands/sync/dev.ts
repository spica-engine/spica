import path from "path";
import fs from "fs";
import chokidar from "chokidar";
import {ActionParameters, Command, Program} from "@caporal/core";
import {bold, cyan, green, red, yellow} from "colorette";
import {httpService} from "../../http";
import {context} from "../../context";
import {config} from "../../config";
import {buildPlan, applyPlan, renderPlan} from "./planner";
import {confirm} from "./prompt";
import {resolveModules, MODULE_NAMES} from "./modules/index";
import {readYaml, readText} from "./fs-utils";
import {ResourceModule, LocalResource} from "./types";
import {FunctionData} from "./modules/function";

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

const FUNCTION_FILES_RE = /^(?:schema\.yaml|index\.(?:ts|mjs|js)|package\.json)$/;

function buildWatchIgnored(modules: ResourceModule[], rootDir: string) {
  const moduleNames = new Set(modules.map(m => m.name));
  return (filePath: string, stats?: fs.Stats) => {
    // Never ignore directories — chokidar must recurse into them
    if (!stats || stats.isDirectory()) return false;
    const rel = path.relative(rootDir, filePath);
    const parts = rel.split(path.sep);
    // Ignore files outside <moduleName>/<slug>/<file> depth
    if (parts.length !== 3) return true;
    const [moduleName, , file] = parts;
    if (!moduleNames.has(moduleName)) return true;
    if (moduleName === "function") return !FUNCTION_FILES_RE.test(file);
    return file !== "schema.yaml";
  };
}

// ─── Function-module helpers ─────────────────────────────────────────────────

function indexFilename(language?: string): string {
  return language === "typescript" ? "index.ts" : "index.mjs";
}

function readLocalFunction(rootDir: string, slug: string): LocalResource<FunctionData> | null {
  const fnDir = path.join(rootDir, "function", slug);
  const schema = readYaml<FunctionData["schema"]>(path.join(fnDir, "schema.yaml"));
  if (!schema) return null;
  const filename = indexFilename(schema.language as string | undefined);
  const index = readText(path.join(fnDir, filename)) ?? "";
  let dependencies: Record<string, string> = {};
  const pkgText = readText(path.join(fnDir, "package.json"));
  if (pkgText) {
    try {
      dependencies = JSON.parse(pkgText).dependencies ?? {};
    } catch {
      /* ignore */
    }
  }
  return {slug, data: {schema, index, dependencies} as FunctionData};
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
  /** Delay (ms) between retries when waiting for function index/package (default 200) */
  fnFileRetryDelayMs?: number;
  /** Max retries when waiting for function index/package (default 5) */
  fnFileMaxRetries?: number;
}

export interface DevDispatcher {
  handleEvent(type: "add" | "change" | "unlink", absolutePath: string): Promise<void>;
  /** Drain all pending timers (for testing) */
  dispose(): void;
}

export function createDevDispatcher(opts: DevDispatcherOptions): DevDispatcher {
  const {
    modules,
    http,
    rootDir,
    state,
    renameWindowMs = 500,
    fnFileRetryDelayMs = 200,
    fnFileMaxRetries = 5
  } = opts;
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

  // ── schema-module handler (bucket / env-var / secret / policy) ─────────────

  async function handleSchemaAdd(mod: ResourceModule, slug: string): Promise<void> {
    // Check for rename promotion: does a pending delete exist for this module
    // with an _id that matches the newly written schema?
    const pendingKey = `${mod.name}:${slug}`;
    // Also check all pending deletes for this module to find a matching _id
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
      // Rename: cancel the pending delete and run update instead
      const pending = pendingDeletes.get(promotedKey)!;
      clearTimeout(pending.timer);
      pendingDeletes.delete(promotedKey);
      // Re-map slug → remoteId to new slug
      clearRemoteId(mod.name, pending.slug);
      setRemoteId(mod.name, slug, pending.remoteId);
      log(`${cyan("~")} [${mod.name}] ${bold(pending.slug)} ${cyan("→")} ${bold(slug)}  ${yellow("(rename → update)")}`);
      try {
        await mod.update(http, local, pending.remoteId);
        log(`${green("✓")} [${mod.name}] updated ${bold(slug)}`);
      } catch (err) {
        warn(`${red("✗")} [${mod.name}] update ${slug}: ${formatError(err)}`);
      }
      return;
    }

    const remoteId = getRemoteId(mod.name, slug);
    if (remoteId) {
      // File re-added but we already track it — treat as update
      try {
        await mod.update(http, local, remoteId);
        log(`${green("✓")} [${mod.name}] updated ${bold(slug)}`);
      } catch (err) {
        warn(`${red("✗")} [${mod.name}] update ${slug}: ${formatError(err)}`);
      }
    } else {
      // Genuinely new
      try {
        log(`${green("+")} [${mod.name}] creating ${bold(slug)}…`);
        await mod.create(http, local);
        // Refresh state to capture new remote id
        await refreshStateForModule(mod, http, state, rootDir);
        log(`${green("✓")} [${mod.name}] created ${bold(slug)}`);
      } catch (err) {
        warn(`${red("✗")} [${mod.name}] create ${slug}: ${formatError(err)}`);
      }
    }
  }

  async function handleSchemaChange(mod: ResourceModule, slug: string): Promise<void> {
    const local = readLocalSchema(mod, rootDir, slug);
    if (!local) return;
    const remoteId = getRemoteId(mod.name, slug);
    if (!remoteId) {
      // Treat as create
      return handleSchemaAdd(mod, slug);
    }
    try {
      await mod.update(http, local, remoteId);
      log(`${green("✓")} [${mod.name}] updated ${bold(slug)}`);
    } catch (err) {
      warn(`${red("✗")} [${mod.name}] update ${slug}: ${formatError(err)}`);
    }
  }

  async function handleSchemaUnlink(mod: ResourceModule, slug: string): Promise<void> {
    const remoteId = getRemoteId(mod.name, slug);
    if (!remoteId) return; // nothing to delete

    const pendingKey = `${mod.name}:${slug}`;
    if (pendingDeletes.has(pendingKey)) return; // already pending

    const timer = setTimeout(async () => {
      pendingDeletes.delete(pendingKey);
      clearRemoteId(mod.name, slug);
      try {
        await mod.delete(http, remoteId);
        log(`${red("-")} [${mod.name}] deleted ${bold(slug)}`);
      } catch (err) {
        warn(`${red("✗")} [${mod.name}] delete ${slug}: ${formatError(err)}`);
      }
    }, renameWindowMs);

    pendingDeletes.set(pendingKey, {timer, moduleName: mod.name, slug, remoteId});
  }

  // ── function-module handler ────────────────────────────────────────────────

  const isFunctionIndexFile = (file: string) =>
    file === "index.ts" || file === "index.mjs" || file === "index.js";
  const isFunctionPackageFile = (file: string) => file === "package.json";

  async function waitForFunctionFiles(rootDir: string, slug: string, schema: FunctionData["schema"]): Promise<boolean> {
    const fnDir = path.join(rootDir, "function", slug);
    const indexFile = indexFilename(schema.language as string | undefined);
    for (let i = 0; i < fnFileMaxRetries; i++) {
      if (
        fs.existsSync(path.join(fnDir, indexFile)) &&
        fs.existsSync(path.join(fnDir, "package.json"))
      ) {
        return true;
      }
      await sleep(fnFileRetryDelayMs);
    }
    // Final check
    return (
      fs.existsSync(path.join(fnDir, indexFile)) &&
      fs.existsSync(path.join(fnDir, "package.json"))
    );
  }

  async function handleFunctionSchemaAdd(slug: string): Promise<void> {
    const mod = moduleMap.get("function")!;
    const schemaPath = path.join(rootDir, "function", slug, "schema.yaml");
    const schema = readYaml<FunctionData["schema"]>(schemaPath);
    if (!schema) return;

    // Check rename promotion
    const newLocalId = schema._id as string | undefined;
    let promotedKey: string | undefined;
    if (newLocalId) {
      for (const [key, pending] of pendingDeletes) {
        if (pending.moduleName === "function" && pending.remoteId === newLocalId) {
          promotedKey = key;
          break;
        }
      }
    }

    if (promotedKey) {
      // Rename: cancel pending delete
      const pending = pendingDeletes.get(promotedKey)!;
      clearTimeout(pending.timer);
      pendingDeletes.delete(promotedKey);
      clearRemoteId("function", pending.slug);
      setRemoteId("function", slug, pending.remoteId);

      // Wait for all files then update
      const allPresent = await waitForFunctionFiles(rootDir, slug, schema);
      if (!allPresent) {
        warn(`${yellow("⚠")} [function] timeout waiting for index/package of ${slug} after rename`);
        return;
      }
      const local = readLocalFunction(rootDir, slug);
      if (!local) return;
      log(`${cyan("~")} [function] ${bold(pending.slug)} ${cyan("→")} ${bold(slug)}  ${yellow("(rename → update)")}`);
      try {
        await mod.update(http, local, pending.remoteId);
        log(`${green("✓")} [function] updated ${bold(slug)}`);
      } catch (err) {
        warn(`${red("✗")} [function] update ${slug}: ${formatError(err)}`);
      }
      return;
    }

    const remoteId = getRemoteId("function", slug);
    if (remoteId) {
      // Already exists remotely — treat as update; wait for files
      const allPresent = await waitForFunctionFiles(rootDir, slug, schema);
      if (!allPresent) {
        warn(`${yellow("⚠")} [function] timeout waiting for index/package of ${slug}`);
        return;
      }
      const local = readLocalFunction(rootDir, slug);
      if (!local) return;
      try {
        await mod.update(http, local, remoteId);
        log(`${green("✓")} [function] updated ${bold(slug)}`);
      } catch (err) {
        warn(`${red("✗")} [function] update ${slug}: ${formatError(err)}`);
      }
    } else {
      // New function: wait for index + package, then create
      log(`${green("+")} [function] creating ${bold(slug)}…`);
      const allPresent = await waitForFunctionFiles(rootDir, slug, schema);
      if (!allPresent) {
        warn(`${yellow("⚠")} [function] timeout waiting for index/package of ${slug}; skipping create`);
        return;
      }
      const local = readLocalFunction(rootDir, slug);
      if (!local) return;
      try {
        await mod.create(http, local);
        await refreshStateForModule(mod, http, state, rootDir);
        log(`${green("✓")} [function] created ${bold(slug)}`);
      } catch (err) {
        warn(`${red("✗")} [function] create ${slug}: ${formatError(err)}`);
      }
    }
  }

  async function handleFunctionFileChange(slug: string): Promise<void> {
    const mod = moduleMap.get("function")!;
    const remoteId = getRemoteId("function", slug);
    if (!remoteId) return; // No remote yet; schema add will handle creation
    const local = readLocalFunction(rootDir, slug);
    if (!local) return;
    try {
      await mod.update(http, local, remoteId);
      log(`${green("✓")} [function] updated ${bold(slug)}`);
    } catch (err) {
      warn(`${red("✗")} [function] update ${slug}: ${formatError(err)}`);
    }
  }

  async function handleFunctionSchemaUnlink(slug: string): Promise<void> {
    const mod = moduleMap.get("function")!;
    const remoteId = getRemoteId("function", slug);
    if (!remoteId) return;

    const pendingKey = `function:${slug}`;
    if (pendingDeletes.has(pendingKey)) return;

    const timer = setTimeout(async () => {
      pendingDeletes.delete(pendingKey);
      clearRemoteId("function", slug);
      try {
        await mod.delete(http, remoteId);
        log(`${red("-")} [function] deleted ${bold(slug)}`);
      } catch (err) {
        warn(`${red("✗")} [function] delete ${slug}: ${formatError(err)}`);
      }
    }, renameWindowMs);

    pendingDeletes.set(pendingKey, {timer, moduleName: "function", slug, remoteId});
  }

  // ── main dispatcher ────────────────────────────────────────────────────────

  async function handleEvent(type: "add" | "change" | "unlink", absolutePath: string): Promise<void> {
    const parsed = parseFilePath(absolutePath);
    if (!parsed) return;

    const {moduleName, slug, file} = parsed;
    const mod = moduleMap.get(moduleName);
    if (!mod) return;

    if (moduleName === "function") {
      if (type === "add" && file === "schema.yaml") {
        await handleFunctionSchemaAdd(slug);
      } else if (type === "change" && file === "schema.yaml") {
        // schema change: update if exists
        const remoteId = getRemoteId("function", slug);
        if (remoteId) {
          await handleFunctionFileChange(slug);
        }
        // else: wait for schema add path to handle it
      } else if (type === "change" && (isFunctionIndexFile(file) || isFunctionPackageFile(file))) {
        await handleFunctionFileChange(slug);
      } else if (type === "add" && (isFunctionIndexFile(file) || isFunctionPackageFile(file))) {
        // Re-add of index/package: treat as update if function already exists
        await handleFunctionFileChange(slug);
      } else if (type === "unlink" && file === "schema.yaml") {
        await handleFunctionSchemaUnlink(slug);
      } else if (type === "unlink" && (isFunctionIndexFile(file) || isFunctionPackageFile(file))) {
        warn(
          `${yellow("⚠")} [function] Removing ${bold(file)} has no effect on the remote function. ` +
            `Restore the file or delete schema.yaml to remove the function.`
        );
      }
    } else {
      // Schema-only modules
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
        `   ${bold("sync dev")} is designed for local Spica instances. ` +
        `Using it against a remote HTTPS endpoint may have unintended side-effects.\n` +
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
