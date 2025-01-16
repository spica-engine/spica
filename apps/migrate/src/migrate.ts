import * as color from "cli-color";
import * as mongodb from "mongodb";
import * as path from "path";
import * as fs from "fs";
import * as semver from "semver";
import {setSession} from "./session";
import MigrationsIndex = require("./migrations/index.json");

export type MigrationManifest = {
  [k: string]: string[];
};

function getManifestDir() {
  let manifestDir = "./";
  const isTestEnv = process.env.NODE_ENV == "test";
  if (isTestEnv) {
    manifestDir = process.env.TESTONLY_MIGRATION_LOOKUP_DIR;
  }
  return manifestDir;
}

export function loadMigrations(): MigrationManifest {
  const manifestDir = getManifestDir();
  try {
    console.log("reading from manifest : " + manifestDir);
    return JSON.parse(
      fs.readFileSync(path.join(manifestDir, "migrations", "index.json")).toString()
    );
  } catch (e) {
    console.log(e);
    return MigrationsIndex as MigrationManifest;
  }
}

export function migrationVersions(from: string, to: string): string[] {
  return Object.keys(loadMigrations())
    .sort(semver.compare)
    .filter(migration => {
      return semver.gt(migration, from) && semver.lte(migration, to);
    });
}

export function getMigrations(version: string): string[] {
  return loadMigrations()[version].map(script =>
    path.isAbsolute(script) ? script : path.join(getManifestDir(), "migrations", script)
  );
}

export async function migrate(options: Options) {
  const versions = migrationVersions(options.from, options.to);
  console.log(`${color.green("VERSIONS:")} ${versions.join(", ") || "None"}`);

  const mongo = new mongodb.MongoClient(options.database.uri, {
    appName: "spicaengine/migrate"
  });
  await mongo.connect();

  const db = mongo.db(options.database.name);

  const ctx: Context = {
    database: db,
    console: options.console
  };

  const session = mongo.startSession();
  session.startTransaction();
  setSession(session);

  let error: Error;

  for (const version of versions) {
    ctx.console.info(`${color.yellow("VERSION:")} ${version}`);
    for (const script of getMigrations(version)) {
      ctx.console.log(`${color.green("APPLYING:")} ${script}`);
      try {
        const module = await import(script);
        await module.default(ctx);
        ctx.console.log(`${color.green("SUCCESS:")} ${script}`);
      } catch (e) {
        ctx.console.error(`${color.red("FAILED:")} ${script}`);
        console.error(e);
        error = e;

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
      ctx.console.info(
        color.blue("Migration was successful but no changes were made due to --dry-run flag.")
      );
      await session.abortTransaction();
    }
  } else {
    ctx.console.error(color.red("Migration has failed."));
  }
  session.endSession();
  await mongo.close();
  setSession(undefined);

  if (error) {
    return Promise.reject(error);
  }
}

export interface Options {
  from: string;
  to: string;
  dryRun?: boolean;
  console: typeof console;
  database: {
    uri: string;
    name: string;
  };
}

export type Context = {
  database: mongodb.Db;
  console: typeof console;
};
