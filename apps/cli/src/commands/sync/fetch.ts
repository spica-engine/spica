import path from "path";
import {ActionParameters, Command, Program} from "@caporal/core";
import caporalCore from "@caporal/core";
const {CaporalValidator} = caporalCore;
import {bold, green, red, yellow} from "colorette";
import {httpService} from "../../http";
import {buildPlan, fetchToDisk, renderPlan} from "./planner";
import {confirm} from "./prompt";
import {resolveModules, MODULE_NAMES} from "./modules/index";

async function fetch_({args, options}: ActionParameters) {
  const rootDir = path.resolve((args.dir as string | undefined) ?? process.cwd());
  const autoApprove = !!options.autoApprove;
  const concurrency = (options.concurrency as number) ?? 10;
  const abortOnError = !!options.abortOnError;
  const detailed = !!options.detailed;
  const clean = !!options.clean;
  const moduleFilter = options.module
    ? (Array.isArray(options.module) ? options.module : [options.module]).map(String)
    : undefined;

  const modules = resolveModules(moduleFilter);
  const http = await httpService.createFromCurrentCtx();

  console.log(bold("\nBuilding plan…"));
  const p = await buildPlan(modules, http, rootDir);

  // Fetch perspective: deletes = new remote files to write, updates = changed to overwrite,
  // creates = local-only stale files (removed only with --clean)
  const toWrite = p.modules.reduce((n, m) => n + m.deletes.length + m.updates.length, 0);
  const toDelete = p.modules.reduce((n, m) => n + m.creates.length, 0);
  const effectiveChanges = toWrite + (clean ? toDelete : 0);

  renderPlan(p, {detailed, fetchMode: true, clean});

  if (effectiveChanges === 0) {
    process.exitCode = 0;
    return;
  }

  if (!autoApprove) {
    const ok = await confirm("\nApply these changes?");
    if (!ok) {
      console.log(bold(yellow("Aborted. No changes were applied.")));
      process.exitCode = 1;
      return;
    }
  }

  console.log(bold("\nWriting files…"));
  const {written, deleted, errors} = await fetchToDisk(p, http, rootDir, {
    concurrency,
    abortOnError,
    clean
  });

  if (errors.length) {
    console.log(bold(yellow(`\n⚠  Completed with ${errors.length} error(s):`)));
    for (const e of errors) console.log(`   ${red("✗")} ${e}`);
    process.exitCode = 1;
  } else {
    console.log(
      bold(green(`\n✓ Fetch complete.`)) +
        `  ${green(`+${written} written`)}` +
        (deleted ? `  ${red(`-${deleted} deleted`)}` : "")
    );
    process.exitCode = 0;
  }
}

export default function (program: Program): Command {
  return program
    .command("fetch", "Export remote Spica resources into local project files.")
    .argument("[dir]", "Project directory (default: current working directory)")
    .option("--auto-approve, -y", "Skip confirmation prompt and write immediately.", {
      default: false
    })
    .option("--concurrency <n>", "Maximum parallel file writes.", {
      default: 10 as number,
      validator: CaporalValidator.NUMBER
    })
    .option("--abort-on-error", "Stop immediately if any operation fails.", {default: false})
    .option("--detailed", "Show full unified diffs in the plan before writing.", {default: false})
    .option("--clean", "Remove local resource folders that no longer exist remotely.", {
      default: false
    })
    .option(
      "--module <name>",
      `Filter to specific module(s). Available: ${MODULE_NAMES.join(", ")}. Can be repeated.`,
      {
        validator: CaporalValidator.STRING,
        repeatable: true
      }
    )
    .action(fetch_);
}
