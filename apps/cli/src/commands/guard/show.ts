import {Command, Program} from "@caporal/core";
import {guard} from "../../guard";

async function showGuard() {
  const current = guard.load();

  if (!current) {
    console.info("No guard is set. plan/apply can run from any directory.");
    return;
  }

  console.info(`Path:    ${current.path}`);
  console.info(`Folders: ${current.folders?.length ? current.folders.join(", ") : "none"}`);
  console.info(`File:    ${guard.filePath()}`);
}

export default function (program: Program): Command {
  return program.command("guard show", "Show the current plan/apply guard.").action(showGuard);
}
