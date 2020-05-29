import * as color from "cli-color";
import * as fs from "fs";
import * as mongodb from "mongodb";
import * as path from "path";
import * as semver from "semver";
import {setSession} from "./session";

export function loadMigrations(): {
  [k: string]: string[];
} {
  return JSON.parse(fs.readFileSync("./migrations/index.json").toString());
}

export function migrationVersions(from: string, to: string): string[] {
  return Object.keys(loadMigrations())
    .sort(semver.compare)
    .filter(migration => {
      return semver.gt(migration, from) && semver.lte(migration, to);
    });
}

function getMigrations(version: string): string[] {
  return loadMigrations()[version].map(script => path.join("migrations", script));
}

export async function migrate(options: Options) {
  const versions = migrationVersions(options.from, options.to);
  console.log(`${color.green("VERSIONS:")} ${versions.join(", ")}`);

  const mongo = await mongodb.connect(options.database.uri, {
    appname: "spicaengine/migrate",
    useNewUrlParser: true
  });
  const db = mongo.db(options.database.name);

  const ctx: Context = {
    database: db,
    console: new console.Console(process.stdout, process.stderr)
  };

  const session = mongo.startSession();
  setSession(session);
  session.startTransaction();

  for (const version of versions) {
    ctx.console.info(`${color.yellow("VERSION:")} ${version}`);
    for (const script of getMigrations(version)) {
      ctx.console.log(`${color.green("APPLYING:")} ${script}`);
      try {
        const module = await import(path.join(__dirname, script));
        await module.default(ctx);
        ctx.console.log(`${color.green("SUCCESS:")} ${script}`);
      } catch (e) {
        ctx.console.error(`${color.red("FAILED:")} ${script}`);
        ctx.console.error(e);
        await session.abortTransaction();
        break; // do not go futher
      }
    }
  }
  if (session.inTransaction()) {
    if (!options.dryRun) {
      await session.commitTransaction();
      ctx.console.info(color.green("Migration was successful."));
    } else {
      ctx.console.info(color.blue("Migration was successful but option --dry-run was given."));
      await session.abortTransaction();
    }
  } else {
    ctx.console.error(color.red("Migration has failed."));
  }
  session.endSession();
  await mongo.close();
}

export interface Options {
  from: string;
  to: string;
  dryRun: boolean;
  database: {
    uri: string;
    name: string;
  };
}

export type Context = {
  database: mongodb.Db;
  console: typeof console;
};
