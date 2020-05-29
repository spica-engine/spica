/* ATTENTION: Do not sort imports of this file */
require("./session");
// Keep as is. We need to evaluate this script before any other script
import * as semver from "semver";
import * as yargs from "yargs";
import {migrate} from "./migrate";

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
    describe: "Run the migration but do not commit the changes."
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
  .parse();

migrate({
  from: args.from.toString(),
  to: args.to.toString(),
  dryRun: args["dry-run"],
  database: {
    name: args["database-name"],
    uri: args["database-uri"]
  }
});
