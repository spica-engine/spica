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

  async function userTables() {
    const {rows} = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    return rows.map(row => row.table_name);
  }

  beforeAll(() => {
    color.disableColor();
  });

  beforeEach(async () => {
    scriptsDir = fs.mkdtempSync(path.join(os.tmpdir(), "spica-pg-migrations-"));
    uri = await createPostgresDatabase();
    args = ["--database-type", "postgresql", "--database-uri", uri];
    client = new pg.Client({connectionString: uri});
    await client.connect();
  });

  afterEach(async () => {
    await client.end();
    fs.rmSync(scriptsDir, {recursive: true, force: true});
    fs.rmSync(indexJsonPath, {force: true});
  });

  const packagedDir = path.join(process.cwd(), "dist/src/postgresql/migrations");

  function usePackagedMigrations() {
    const packaged = JSON.parse(fs.readFileSync(path.join(packagedDir, "index.json")).toString());
    const manifest = Object.fromEntries(
      Object.entries<string[]>(packaged).map(([version, scripts]) => [
        version,
        scripts.map(script => path.join(packagedDir, script))
      ])
    );
    fs.mkdirSync(manifestDir, {recursive: true});
    fs.writeFileSync(indexJsonPath, JSON.stringify(manifest));
  }

  it("should apply the packaged baseline on a fresh database", async () => {
    usePackagedMigrations();

    await run([...args, "--from", "0.0.0", "--to", "99.0.0"]);

    expect(await userTables()).toEqual([]);
  });

  it("should apply pending versions in order", async () => {
    writeMigrations({
      "1.0.0": {"a.sql": "CREATE TABLE first (id int); INSERT INTO first VALUES (1);"},
      "2.0.0": {"b.sql": "ALTER TABLE first ADD COLUMN name text; UPDATE first SET name = 'x';"}
    });
    await run([...args, "--from", "0.1.0", "--to", "2.0.0"]);

    const {rows} = await client.query("SELECT * FROM first");
    expect(rows).toEqual([{id: 1, name: "x"}]);
    expect(await userTables()).toEqual(["first"]);
  });

  it("should only apply versions after --from up to --to", async () => {
    writeMigrations({
      "1.0.0": {"a.sql": "CREATE TABLE v1 (id int);"},
      "2.0.0": {"b.sql": "CREATE TABLE v2 (id int);"},
      "3.0.0": {"c.sql": "CREATE TABLE v3 (id int);"}
    });
    await run([...args, "--from", "1.0.0", "--to", "2.0.0"]);

    const {rows} = await client.query(
      "SELECT to_regclass('v1') AS v1, to_regclass('v2') AS v2, to_regclass('v3') AS v3"
    );
    expect(rows[0]).toEqual({v1: null, v2: "v2", v3: null});
    expect(await userTables()).toEqual(["v2"]);
  });

  it("should roll back every version when one fails", async () => {
    writeMigrations({
      "1.0.0": {"a.sql": "CREATE TABLE good (id int);"},
      "2.0.0": {"b.sql": "THIS IS NOT SQL;"}
    });
    const error = await run([...args, "--from", "0.1.0", "--to", "2.0.0"]).catch(e => e);

    expect(error).toBeInstanceOf(Error);
    const {rows} = await client.query("SELECT to_regclass('good') AS good");
    expect(rows[0]).toEqual({good: null});
  });

  it("should not write anything when --dry-run is set", async () => {
    writeMigrations({"1.0.0": {"a.sql": "CREATE TABLE dry (id int);"}});
    await run([...args, "--from", "0.1.0", "--to", "1.0.0", "--dry-run"]);

    const {rows} = await client.query("SELECT to_regclass('dry') AS dry");
    expect(rows[0]).toEqual({dry: null});
  });

  describe("change triggers", () => {
    const bucketId = "0190f7a0-0000-7000-8000-000000000001";
    const main = `bucket_${bucketId}`;

    it("should announce the writes of bucket tables that already exist", async () => {
      await client.query(
        `CREATE TABLE "${main}" (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text)`
      );
      await client.query(
        `CREATE TABLE "${main}__tags" (_parent uuid NOT NULL REFERENCES "${main}" (id) ON DELETE CASCADE, _position integer NOT NULL, _value text, PRIMARY KEY (_parent, _position))`
      );
      usePackagedMigrations();

      await run([...args, "--from", "0.0.0", "--to", "99.0.0"]);

      const listener = new pg.Client({connectionString: uri});
      await listener.connect();
      const payloads: any[] = [];
      listener.on("notification", message => payloads.push(JSON.parse(message.payload)));
      try {
        await listener.query("LISTEN spica_change");
        const {
          rows: [{id}]
        } = await client.query(`INSERT INTO "${main}" (title) VALUES ('a') RETURNING id`);
        await client.query(`INSERT INTO "${main}__tags" VALUES ($1, 0, 'x')`, [id]);
        for (let waited = 0; waited < 5000 && payloads.length < 2; waited += 50) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        expect(payloads).toMatchObject([
          {t: main, op: "insert", k: id},
          {t: main, op: "update", k: id, f: ["tags"]}
        ]);
      } finally {
        await listener.end();
      }
    });

    it("should be safe to apply twice", async () => {
      usePackagedMigrations();

      await run([...args, "--from", "0.0.0", "--to", "99.0.0"]);
      await run([...args, "--from", "0.0.0", "--to", "99.0.0"]);

      const {rows} = await client.query(
        "SELECT count(*)::int AS count FROM pg_proc WHERE proname = 'spica_notify_change'"
      );
      expect(rows[0].count).toBe(1);
    });
  });
});
