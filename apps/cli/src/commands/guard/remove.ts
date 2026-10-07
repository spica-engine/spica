import {Command, Program} from "@caporal/core";
import {guard} from "../../guard";

async function removeGuard() {
  if (guard.remove()) {
    console.info("Guard has been removed. plan/apply can run from any directory.");
  } else {
    console.info("No guard is set.");
  }
}

export default function (program: Program): Command {
  return program.command("guard remove", "Remove the plan/apply guard.").action(removeGuard);
}
