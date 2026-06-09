import path from "path";
import {ActionParameters, Command, Program} from "@caporal/core";
import {httpService} from "../../http";
import {buildPlan, renderPlan, resolveModules, MODULE_NAMES} from "@spica-server/sync";
import {cliReporter} from "./reporter";

async function plan({args, options}: ActionParameters) {
  try {
    const rootDir = path.resolve((args.dir as string | undefined) ?? process.cwd());
    const detailed = !!options.detailed;
    const json = !!options.json;
    const moduleFilter = options.module
      ? (Array.isArray(options.module) ? options.module : [options.module]).map(String)
      : undefined;

    const modules = resolveModules(moduleFilter);
    const http = await httpService.createFromCurrentCtx();

    const p = await buildPlan(modules, http, rootDir, detailed, true, cliReporter);
    renderPlan(p, {detailed, json});

    process.exitCode = 0;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(msg);
    process.exitCode = 1;
  }
}

export default function (program: Program): Command {
  return program
    .command(
      "plan",
      "Compare local project files with remote Spica resources and show planned changes."
    )
    .argument("[dir]", "Project directory (default: current working directory)")
    .option(
      "--detailed",
      "Show full unified diffs for changed resources instead of just field names.",
      {default: false}
    )
    .option("--json", "Output the plan as JSON (machine-readable).", {default: false})
    .option(
      "--module <name>",
      `Filter to specific module(s). Available: ${MODULE_NAMES.join(", ")}.`,
      {
        validator: MODULE_NAMES
      }
    )
    .action(plan);
}
