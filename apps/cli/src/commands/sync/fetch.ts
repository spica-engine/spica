import path from "path";
import {ActionParameters, Command, Program} from "@caporal/core";
import caporalCore from "@caporal/core";
const {CaporalValidator} = caporalCore;
import {bold, green, yellow} from "colorette";
import {httpService} from "../../http";
import {buildPlan, fetchToDisk, renderPlan} from "./planner";
import {confirm} from "./prompt";
import {resolveModules, MODULE_NAMES} from "./modules/index";

async function fetch_({args, options}: ActionParameters) {
  const rootDir = path.resolve((args.dir as string | undefined) ?? process.cwd());
  const clean = !!options.clean;
  const force = !!options.force;
  const moduleFilter = options.module
    ? (Array.isArray(options.module) ? options.module : [options.module]).map(String)
    : undefined;

  const modules = resolveModules(moduleFilter);
  const http = await httpService.createFromCurrentCtx();

  // Build plan to show what will be written / deleted before doing it
  console.log(bold("\nComputing changes…"));
  const p = await buildPlan(modules, http, rootDir);

  const totalRemote = p.modules.reduce((n, m) => n + m.deletes.length + m.updates.length, 0);
  const toDelete = p.modules.reduce((n, m) => n + m.creates.length, 0);

  // Render a short summary (creates = new remote resources, updates = changed remote resources)
  console.log(
    `\n  ${green(`${totalRemote}`)} remote resource(s) will be written to disk.` +
      (clean && toDelete > 0
        ? `\n  ${yellow(`${toDelete}`)} local resource(s) not present remotely will be removed (--clean).`
        : "")
  );

  if (totalRemote === 0 && (!clean || toDelete === 0)) {
    console.log(bold(green("\n✓ Nothing to fetch. Local files are already up-to-date.")));
    return;
  }

  if (!force) {
    const ok = await confirm("\nProceed?");
    if (!ok) {
      console.log(bold(yellow("Aborted.")));
      return;
    }
  }

  const {written, deleted} = await fetchToDisk(modules, http, rootDir, {clean});

  console.log(
    bold(green(`\n✓ Fetch complete.`)) +
      `  ${green(`${written} written`)}` +
      (deleted ? `  ${yellow(`${deleted} deleted`)}` : "")
  );
}

export default function (program: Program): Command {
  return program
    .command(
      "fetch",
      "Export remote Spica resources into local project files."
    )
    .argument("[dir]", "Project directory (default: current working directory)")
    .option("--clean", "Remove local resource folders that no longer exist remotely.", {
      default: false
    })
    .option("--force", "Skip confirmation prompt and write immediately.", {default: false})
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
