import color from "cli-color";
import fs from "fs";
import path from "path";
import pg from "pg";
import semver from "semver";
import PostgreSQLMigrationsIndex from "./migrations/index.json" with {type: "json"};
import {getManifestDir} from "../manifest-dir.js";
import type {MigrationManifest, Options} from "../migrate.js";

const VERSION_TABLE = "spica_migrations";
const LOCK_KEY = "spica_migrations";

function migrationsDir() {
  return path.join(getManifestDir(), "postgresql", "migrations");
}

export function loadPostgreSQLMigrations(): MigrationManifest {
  try {
    return JSON.parse(fs.readFileSync(path.join(migrationsDir(), "index.json")).toString());
  } catch {
    return PostgreSQLMigrationsIndex as MigrationManifest;
  }
}

export function postgreSQLMigrationVersions(from: string, to: string): string[] {
  return Object.keys(loadPostgreSQLMigrations())
    .sort(semver.compare)
    .filter(version => semver.gt(version, from) && semver.lte(version, to));
}

export function getPostgreSQLMigrations(version: string): string[] {
  return loadPostgreSQLMigrations()[version].map(script =>
    path.isAbsolute(script) ? script : path.join(migrationsDir(), script)
  );
}

export async function migratePostgreSQL(options: Options) {
  const versions = postgreSQLMigrationVersions(options.from, options.to);
  options.console.log(`${color.green("VERSIONS:")} ${versions.join(", ") || "None"}`);

  const uri = new URL(options.database.uri);
  const username = process.env.POSTGRES_USERNAME;
  const password = process.env.POSTGRES_PASSWORD;
  if (username && password) {
    uri.username = encodeURIComponent(username);
    uri.password = encodeURIComponent(password);
  }

  const client = new pg.Client({
    connectionString: uri.toString(),
    application_name: "spicaengine/migrate"
  });
  await client.connect();

  let error: Error;

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [LOCK_KEY]);
    await client.query(
      `CREATE TABLE IF NOT EXISTS ${VERSION_TABLE} (
        version text PRIMARY KEY,
        scripts text[] NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`
    );

    const {rows} = await client.query<{version: string}>(`SELECT version FROM ${VERSION_TABLE}`);
    const applied = new Set(rows.map(row => row.version));

    for (const version of versions) {
      if (applied.has(version)) {
        options.console.info(`${color.yellow("SKIPPING:")} ${version} was already applied`);
        continue;
      }

      options.console.info(`${color.yellow("VERSION:")} ${version}`);
      const scripts = getPostgreSQLMigrations(version);
      for (const script of scripts) {
        options.console.log(`${color.green("APPLYING:")} ${script}`);
        try {
          await client.query(fs.readFileSync(script).toString());
        } catch (e) {
          options.console.error(`${color.red("FAILED:")} ${script}`);
          throw e;
        }
        options.console.log(`${color.green("SUCCESS:")} ${script}`);
      }

      await client.query(`INSERT INTO ${VERSION_TABLE} (version, scripts) VALUES ($1, $2)`, [
        version,
        scripts.map(script => path.basename(script))
      ]);
    }

    if (options.dryRun) {
      await client.query("ROLLBACK");
      options.console.info(
        color.blue("Migration was successful but no changes were made due to --dry-run flag.")
      );
    } else {
      await client.query("COMMIT");
      options.console.info(color.green("Migration was successful."));
    }
  } catch (e) {
    error = e;
    console.error(e);
    await client.query("ROLLBACK").catch(() => undefined);
    options.console.error(color.red("Migration has failed."));
  } finally {
    await client.end();
  }

  if (error) {
    return Promise.reject(error);
  }
}
