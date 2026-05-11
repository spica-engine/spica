import path from "path";
import {ActionParameters, Command, Program} from "@caporal/core";
import {httpService} from "../../http";
import {buildPlan, renderPlan} from "./planner";
import {resolveModules, MODULE_NAMES} from "./modules/index";

async function plan({args, options}: ActionParameters) {
  const rootDir = path.resolve((args.dir as string | undefined) ?? process.cwd());
  const detailed = !!options.detailed;
  const json = !!options.json;
  const moduleFilter = options.module
    ? (Array.isArray(options.module) ? options.module : [options.module]).map(String)
    : undefined;

  const modules = resolveModules(moduleFilter);
  const http = await httpService.createFromCurrentCtx();

  const p = await buildPlan(modules, http, rootDir, detailed);
  renderPlan(p, {detailed, json});

  const totalChanges = p.modules.reduce(
    (n, m) => n + m.creates.length + m.updates.length + m.deletes.length,
    0
  );

  // Exit code 2 when changes exist (Terraform-style), enables CI gating
  process.exitCode = totalChanges > 0 ? 2 : 0;
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
