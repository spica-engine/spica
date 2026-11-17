import {createPostgresDatabase} from "@spica-server/database-testing";
import {randomBytes} from "crypto";
import pg from "pg";

describe("pg_cron", () => {
  let appUri: string;
  let cronUri: string;
  let admin: pg.Client;

  const connect = async (connectionString: string) => {
    const client = new pg.Client({connectionString});
    await client.connect();
    return client;
  };

  beforeAll(async () => {
    appUri = await createPostgresDatabase();
    const uri = new URL(appUri);
    uri.pathname = "/postgres";
    cronUri = uri.toString();
    admin = await connect(cronUri);
  });

  afterAll(() => admin.end());

  it("should have the extension preloaded in the cron database", async () => {
    const {rows} = await admin.query(
      "SELECT current_setting('cron.database_name') AS database, " +
        "(SELECT count(*) FROM pg_extension WHERE extname = 'pg_cron')::int AS installed"
    );

    expect(rows[0]).toEqual({database: "postgres", installed: 1});
  });

  describe("as the unprivileged application role", () => {
    const role = `spica_cron_${randomBytes(4).toString("hex")}`;
    let app: pg.Client;
    let cron: pg.Client;

    beforeAll(async () => {
      await admin.query(`CREATE ROLE ${role} LOGIN PASSWORD 'spica'`);
      await admin.query(`GRANT USAGE ON SCHEMA cron TO ${role}`);
      await admin.query(
        `GRANT EXECUTE ON FUNCTION cron.schedule_in_database(text, text, text, text, text, boolean) TO ${role}`
      );

      const adminApp = await connect(appUri);
      await adminApp.query(`GRANT ALL ON SCHEMA public TO ${role}`);
      await adminApp.end();

      const asRole = (uri: string) => {
        const url = new URL(uri);
        url.username = role;
        url.password = "spica";
        return url.toString();
      };
      app = await connect(asRole(appUri));
      cron = await connect(asRole(cronUri));
      await app.query(
        "CREATE TABLE logs (id serial, created_at timestamptz NOT NULL DEFAULT now())"
      );
    });

    afterAll(async () => {
      await app.end();
      await cron.end();
    });

    const appDatabase = () => new URL(appUri).pathname.slice(1);

    const schedule = (name: string, command: string) =>
      cron.query("SELECT cron.schedule_in_database($1, '* * * * *', $2, $3) AS id", [
        name,
        command,
        appDatabase()
      ]);

    it("should schedule a job in the application database that runs as the role", async () => {
      await schedule("test:logs", "SELECT 1");

      const {rows} = await cron.query(
        "SELECT database, username, schedule FROM cron.job WHERE jobname = 'test:logs'"
      );
      expect(rows).toEqual([{database: appDatabase(), username: role, schedule: "* * * * *"}]);
    });

    it("should update the job in place when scheduled again under the same name", async () => {
      const first = await schedule("test:update", "SELECT 1");
      const second = await schedule("test:update", "SELECT 2");

      expect(second.rows[0].id).toEqual(first.rows[0].id);
      const {rows} = await cron.query("SELECT command FROM cron.job WHERE jobname = 'test:update'");
      expect(rows).toEqual([{command: "SELECT 2"}]);
    });

    it("should not let the role schedule a job for another role", async () => {
      await expect(
        cron.query(
          "SELECT cron.schedule_in_database('test:other', '* * * * *', 'SELECT 1', $1, 'postgres')",
          [appDatabase()]
        )
      ).rejects.toThrow(/superuser/);
    });

    it("should let the stored command delete only the expired rows", async () => {
      await app.query("INSERT INTO logs (created_at) VALUES (now() - interval '1 hour'), (now())");
      await schedule(
        "test:purge",
        "DELETE FROM logs WHERE created_at < now() - make_interval(secs => 60)"
      );

      const {rows} = await cron.query("SELECT command FROM cron.job WHERE jobname = 'test:purge'");
      await app.query(rows[0].command);

      const remaining = await app.query("SELECT count(*)::int AS count FROM logs");
      expect(remaining.rows[0].count).toBe(1);
    });
  });
});
