import color from "cli-color";
import fs from "fs";
import path from "path";
import pg from "pg";
import semver from "semver";
import {fileURLToPath} from "url";

export type PostgreSQLMigrationManifest = {
  [version: string]: string[];
};

export interface PostgreSQLMigrateOptions {
  uri: string;
  from: string;
  to: string;
  dryRun?: boolean;
  console: typeof console;
  migrationsDir?: string;
}

const VERSION_TABLE = "spica_migrations";
const LOCK_KEY = "spica_migrations";

export const PACKAGED_MIGRATIONS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "migrations"
);

export function loadPostgreSQLMigrations(
  migrationsDir = PACKAGED_MIGRATIONS_DIR
): PostgreSQLMigrationManifest {
  return JSON.parse(fs.readFileSync(path.join(migrationsDir, "index.json")).toString());
}

export function postgreSQLMigrationVersions(
  from: string,
  to: string,
  migrationsDir = PACKAGED_MIGRATIONS_DIR
): string[] {
  return Object.keys(loadPostgreSQLMigrations(migrationsDir))
    .sort(semver.compare)
    .filter(version => semver.gt(version, from) && semver.lte(version, to));
}

export function getPostgreSQLMigrations(
  version: string,
  migrationsDir = PACKAGED_MIGRATIONS_DIR
): string[] {
  return loadPostgreSQLMigrations(migrationsDir)[version].map(script =>
    path.isAbsolute(script) ? script : path.join(migrationsDir, script)
  );
}

export async function migratePostgreSQL(options: PostgreSQLMigrateOptions) {
  const migrationsDir = options.migrationsDir ?? PACKAGED_MIGRATIONS_DIR;
  const versions = postgreSQLMigrationVersions(options.from, options.to, migrationsDir);
  options.console.log(`${color.green("VERSIONS:")} ${versions.join(", ") || "None"}`);

  const client = new pg.Client({
    connectionString: options.uri,
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
      const scripts = getPostgreSQLMigrations(version, migrationsDir);
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
