import path from "path";
import {migratePostgreSQL as applyMigrations} from "@spica-server/data-postgresql-migrations";
import {getManifestDir} from "../manifest-dir.js";
import type {Options} from "../migrate.js";

export async function migratePostgreSQL(options: Options) {
  const uri = new URL(options.database.uri);
  const username = process.env.POSTGRES_USERNAME;
  const password = process.env.POSTGRES_PASSWORD;
  if (username && password) {
    uri.username = encodeURIComponent(username);
    uri.password = encodeURIComponent(password);
  }

  return applyMigrations({
    uri: uri.toString(),
    from: options.from,
    to: options.to,
    dryRun: options.dryRun,
    console: options.console,
    migrationsDir:
      process.env.NODE_ENV == "test"
        ? path.join(getManifestDir(), "postgresql", "migrations")
        : undefined
  });
}
