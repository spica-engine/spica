import color from "cli-color";
import mongodb from "mongodb";
import path from "path";
import fs from "fs";
import semver from "semver";
import MigrationsIndex from "./migrations/index.json" with {type: "json"};
import {fileURLToPath} from "url";

export type MigrationManifest = {
  [k: string]: string[];
};

function getManifestDir() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  let manifestDir = __dirname;
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

  const username = process.env.MONGODB_USERNAME;
  const password = process.env.MONGODB_PASSWORD;

  if (username && password) {
    const uri = new URL(options.database.uri);

    uri.username = encodeURIComponent(username);
    uri.password = encodeURIComponent(password);

    options.database.uri = uri.toString();
  }

  const mongo = new mongodb.MongoClient(options.database.uri, {
    appName: "spicaengine/migrate"
  });
  await mongo.connect();

  const db = mongo.db(options.database.name);

  const session = mongo.startSession();
  session.startTransaction();

  const ctx: Context = {
    database: db,
    console: options.console,
    session
  };

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
  session: mongodb.ClientSession;
};
