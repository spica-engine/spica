import fs from "fs";
import path from "path";
import {ActionParameters, Command, Program} from "@caporal/core";
import {guard} from "../../guard";

async function setGuard({options}: ActionParameters) {
  const dir = path.resolve(String(options.path));

  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    console.error(`Error: "${dir}" does not exist or is not a directory.`);
    process.exitCode = 1;
    return;
  }

  const folders = options.folders
    ? [
        ...new Set(
          String(options.folders)
            .split(",")
            .map(f => f.trim())
            .filter(Boolean)
        )
      ]
    : [];

  guard.save({path: dir, folders});

  console.info(`Guard has been set. "spica plan" and "spica apply" can only run from "${dir}".`);

  if (!folders.length) {
    console.info("Required folders: none");
    return;
  }

  console.info(`Required folders: ${folders.join(", ")}`);
  const missing = guard.missingFolders(dir, folders);
  if (missing.length) {
    console.warn(
      `Warning: "${dir}" is currently missing: ${missing.join(", ")}. Commands will fail until they exist.`
    );
  }
}

export default function (program: Program): Command {
  return program
    .command("guard set", "Restrict plan/apply to a project directory.")
    .option("--path <path>", "Directory that plan/apply must be run from.", {required: true})
    .option(
      "--folders <folders>",
      "Comma-separated folders that must exist in the directory, e.g. bucket,env-var,function,policy,secret."
    )
    .action(setGuard);
}
