import {createPostgresDatabase} from "@spica-server/database-testing";
import pg from "pg";

describe("Testing database", () => {
  async function query<T extends pg.QueryResultRow>(uri: string, sql: string) {
    const client = new pg.Client({connectionString: uri});
    await client.connect();
    try {
      return (await client.query<T>(sql)).rows;
    } finally {
      await client.end();
    }
  }

  it("should apply the system migrations to every new database", async () => {
    const uri = await createPostgresDatabase();
    const rows = await query<{version: string}>(uri, "SELECT version FROM spica_migrations");
    expect(rows.length).toBeGreaterThan(0);
  });

  it("should skip the system migrations when asked to", async () => {
    const uri = await createPostgresDatabase(undefined, {migrate: false});
    const rows = await query<{record: string | null}>(
      uri,
      "SELECT to_regclass('spica_migrations') AS record"
    );
    expect(rows[0].record).toBeNull();
  });
});
