import * as semver from "semver";
import * as yargs from "yargs";
import {migrate} from "./migrate";

export async function run(arg?: string | readonly string[]) {
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
    .check(args => {
      if (!semver.valid(args.from) || !semver.valid(args.to)) {
        throw new TypeError("--from or --to was not a valid semver string.");
      }

      if (semver.eq(args.from, args.to)) {
        throw new TypeError("--from and --to can not be equal.");
      }

      if (semver.gt(args.from, args.to)) {
        throw new TypeError("--from must not be greater than --to.");
      }
      return true;
    })
    // Prevent from exiting when testing
    .exitProcess(!arg)
    .parse(arg);

  return migrate({
    from: args.from.toString(),
    to: args.to.toString(),
    dryRun: args["dry-run"],
    console: new console.Console(process.stdout, process.stderr),
    database: {
      name: args["database-name"],
      uri: args["database-uri"]
    }
  });
}

if (require.main == module) {
  run().catch(() => {
    process.exit(1);
  });
}
