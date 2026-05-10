import path from "path";
import {ActionParameters, Command, Program} from "@caporal/core";
import caporalCore from "@caporal/core";
const {CaporalValidator} = caporalCore;
import {bold, green, red, yellow} from "colorette";
import {httpService} from "../../http";
import {applyPlan, buildPlan, renderPlan} from "./planner";
import {confirm} from "./prompt";
import {resolveModules, MODULE_NAMES} from "./modules/index";

async function deploy({args, options}: ActionParameters) {
  const rootDir = path.resolve((args.dir as string | undefined) ?? process.cwd());
  const autoApprove = !!options.autoApprove;
  const concurrency = (options.concurrency as number) ?? 10;
  const abortOnError = !!options.abortOnError;
  const detailed = !!options.detailed;
  const moduleFilter = options.module
    ? (Array.isArray(options.module) ? options.module : [options.module]).map(String)
    : undefined;

  const modules = resolveModules(moduleFilter);
  const http = await httpService.createFromCurrentCtx();

  console.log(bold("\nBuilding plan…"));
  const p = await buildPlan(modules, http, rootDir);

  const totalChanges = p.modules.reduce(
    (n, m) => n + m.creates.length + m.updates.length + m.deletes.length,
    0
  );

  renderPlan(p, {detailed});

  if (totalChanges === 0) {
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

  console.log(bold("\nApplying changes…"));
  const {errors} = await applyPlan(p, http, {concurrency, abortOnError});

  if (errors.length) {
    console.log(bold(yellow(`\n⚠  Completed with ${errors.length} error(s):`)));
    for (const e of errors) console.log(`   ${red("✗")} ${e}`);
    process.exitCode = 1;
  } else {
    const c = p.modules.reduce((n, m) => n + m.creates.length, 0);
    const u = p.modules.reduce((n, m) => n + m.updates.length, 0);
    const d = p.modules.reduce((n, m) => n + m.deletes.length, 0);
    console.log(
      bold(green(`\n✓ Deploy complete.`)) +
        `  ${green(`+${c} created`)}  ${yellow(`~${u} updated`)}  ${red(`-${d} deleted`)}`
    );
    process.exitCode = 0;
  }
}

export default function (program: Program): Command {
  return program
    .command(
      "deploy",
      "Detect changes between local project files and remote Spica resources and apply them."
    )
    .argument("[dir]", "Project directory (default: current working directory)")
    .option("--auto-approve, -y", "Skip confirmation prompt and apply immediately.", {
      default: false
    })
    .option("--concurrency <n>", "Maximum parallel API requests.", {
      default: 10 as number,
      validator: CaporalValidator.NUMBER
    })
    .option("--abort-on-error", "Stop immediately if any operation fails.", {default: false})
    .option("--detailed", "Show full unified diffs in the plan before applying.", {default: false})
    .option(
      "--module <name>",
      `Filter to specific module(s). Available: ${MODULE_NAMES.join(", ")}. Can be repeated.`,
      {
        validator: CaporalValidator.STRING,
        repeatable: true
      }
    )
    .action(deploy);
}
