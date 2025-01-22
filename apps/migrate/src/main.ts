import * as semver from "semver";
import * as yargs from "yargs";
import * as color from "cli-color";
import {migrate} from "./migrate";

export async function run(arg?: string | readonly string[]) {
  const _console = new console.Console(process.stdout, process.stderr);
  const args = yargs
    .option("from", {
      type: "string",
      coerce: semver.coerce,
      demandOption: true
    })
    .option("to", {
      type: "string",
      coerce: semver.coerce,
      demandOption: true
    })
    .option("database-uri", {
      type: "string",
      demandOption: true
    })
    .option("database-name", {
      type: "string",
      demandOption: true
    })
    .option("dry-run", {
      type: "boolean",
      describe: "When true, runs through and reports activity without writing out results."
    })
    .option("continue-if-versions-are-equal", {
      type: "boolean",
      describe: "When true, migration will run even if --from and --to are equal.",
      default: false
    })
    .check(args => {
      if (!semver.valid(args.from) || !semver.valid(args.to)) {
        throw new TypeError("--from or --to was not a valid semver string.");
      }

      if (semver.eq(args.from, args.to)) {
        if (!args["continue-if-versions-are-equal"]) {
          throw new TypeError("--from and --to can not be equal.");
        } else {
          _console.info(
            color.cyan("Not interrupting the migration despite --from and --to were equal.")
          );
        }
      }

      if (semver.gt(args.from, args.to)) {
        throw new TypeError("--from must not be greater than --to.");
      }
      return true;
    })
    // Prevent from exiting when testing
    .exitProcess(!arg)
    .parse(arg);
  
  const resolvedArgs = await args;

  return migrate({
    from: resolvedArgs.from.toString(),
    to: resolvedArgs.to.toString(),
    dryRun: resolvedArgs["dry-run"],
    console: _console,
    database: {
      name: resolvedArgs["database-name"],
      uri: resolvedArgs["database-uri"]
    }
  });
}

if (require.main == module) {
  run().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
