import {createPostgresDatabase} from "@spica-server/database-testing";
import color from "cli-color/lib/supports-color";
import fs from "fs";
import os from "os";
import path from "path";
import pg from "pg";
import {run} from "@spica/migrate";

describe("PostgreSQL track", () => {
  const manifestDir = path.join(
    process.env.TESTONLY_MIGRATION_LOOKUP_DIR,
    "postgresql",
    "migrations"
  );
  const indexJsonPath = path.join(manifestDir, "index.json");
  let scriptsDir: string;
  let uri: string;
  let args: string[];
  let client: pg.Client;

  function writeMigrations(migrations: {[version: string]: {[file: string]: string}}) {
    const manifest = {};
    for (const [version, files] of Object.entries(migrations)) {
      manifest[version] = Object.entries(files).map(([file, sql]) => {
        const script = path.join(scriptsDir, version, file);
        fs.mkdirSync(path.dirname(script), {recursive: true});
        fs.writeFileSync(script, sql);
        return script;
      });
    }
    fs.mkdirSync(manifestDir, {recursive: true});
    fs.writeFileSync(indexJsonPath, JSON.stringify(manifest));
  }

  async function appliedVersions() {
    const {rows} = await client.query("SELECT version FROM spica_migrations ORDER BY version");
    return rows.map(row => row.version);
  }

  beforeAll(() => {
    color.disableColor();
  });

  beforeEach(async () => {
    scriptsDir = fs.mkdtempSync(path.join(os.tmpdir(), "spica-pg-migrations-"));
    uri = await createPostgresDatabase(undefined, {migrate: false});
    args = ["--database-type", "postgresql", "--database-uri", uri];
    client = new pg.Client({connectionString: uri});
    await client.connect();
  });

  afterEach(async () => {
    await client.end();
    fs.rmSync(scriptsDir, {recursive: true, force: true});
    fs.rmSync(indexJsonPath, {force: true});
  });

  it("should apply the packaged baseline on a fresh database", async () => {
    const packagedDir = path.join(
      process.cwd(),
      "../../packages/data/postgresql-migrations/src/migrations"
    );
    const packaged = JSON.parse(fs.readFileSync(path.join(packagedDir, "index.json")).toString());
    const manifest = Object.fromEntries(
      Object.entries<string[]>(packaged).map(([version, scripts]) => [
        version,
        scripts.map(script => path.join(packagedDir, script))
      ])
    );
    fs.mkdirSync(manifestDir, {recursive: true});
    fs.writeFileSync(indexJsonPath, JSON.stringify(manifest));

    await run([...args, "--from", "0.0.0", "--to", "99.0.0"]);

    expect(await appliedVersions()).toEqual(Object.keys(packaged));
  });

  it("should apply pending versions in order and record them", async () => {
    writeMigrations({
      "1.0.0": {"a.sql": "CREATE TABLE first (id int); INSERT INTO first VALUES (1);"},
      "2.0.0": {"b.sql": "ALTER TABLE first ADD COLUMN name text; UPDATE first SET name = 'x';"}
    });
    await run([...args, "--from", "0.1.0", "--to", "2.0.0"]);

    const {rows} = await client.query("SELECT * FROM first");
    expect(rows).toEqual([{id: 1, name: "x"}]);
    expect(await appliedVersions()).toEqual(["1.0.0", "2.0.0"]);
  });

  it("should be a no-op on an already migrated database", async () => {
    writeMigrations({"1.0.0": {"a.sql": "CREATE TABLE once (id int);"}});
    await run([...args, "--from", "0.1.0", "--to", "1.0.0"]);
    await run([...args, "--from", "0.1.0", "--to", "1.0.0"]);

    expect(await appliedVersions()).toEqual(["1.0.0"]);
  });

  it("should only apply versions after --from up to --to", async () => {
    writeMigrations({
      "1.0.0": {"a.sql": "CREATE TABLE v1 (id int);"},
      "2.0.0": {"b.sql": "CREATE TABLE v2 (id int);"},
      "3.0.0": {"c.sql": "CREATE TABLE v3 (id int);"}
    });
    await run([...args, "--from", "1.0.0", "--to", "2.0.0"]);

    expect(await appliedVersions()).toEqual(["2.0.0"]);
  });

  it("should roll back every version when one fails", async () => {
    writeMigrations({
      "1.0.0": {"a.sql": "CREATE TABLE good (id int);"},
      "2.0.0": {"b.sql": "THIS IS NOT SQL;"}
    });
    const error = await run([...args, "--from", "0.1.0", "--to", "2.0.0"]).catch(e => e);

    expect(error).toBeInstanceOf(Error);
    const {rows} = await client.query(
      "SELECT to_regclass('good') AS good, to_regclass('spica_migrations') AS record"
    );
    expect(rows[0]).toEqual({good: null, record: null});
  });

  it("should not write anything when --dry-run is set", async () => {
    writeMigrations({"1.0.0": {"a.sql": "CREATE TABLE dry (id int);"}});
    await run([...args, "--from", "0.1.0", "--to", "1.0.0", "--dry-run"]);

    const {rows} = await client.query(
      "SELECT to_regclass('dry') AS dry, to_regclass('spica_migrations') AS record"
    );
    expect(rows[0]).toEqual({dry: null, record: null});
  });
});
