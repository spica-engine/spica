import {afterAll, beforeAll, describe, expect, it} from "@jest/globals";
import {Pool} from "pg";
import {
  compileCreateSchemas,
  runIdempotentDdl,
  compileFunctionGrants,
  quoteIdentifier,
  roleFromUri
} from "@spica-server/database-postgres";

describe("compileFunctionGrants — the SQL it produces", () => {
  const sql = compileFunctionGrants("fn_role")
    .map(s => s.sql)
    .join(" | ");

  /**
   * the most important claim: there is **no DDL** on the `bucket` schema. The mechanism is "not granting
   * CREATE" — which is why the test has to be written as a negative claim, otherwise a `GRANT CREATE` added
   * one day would pass silently.
   */
  it("does not grant CREATE on the bucket schema", () => {
    expect(sql).toContain('GRANT USAGE ON SCHEMA bucket TO "fn_role"');
    expect(sql).not.toContain("GRANT USAGE, CREATE ON SCHEMA bucket");
    expect(sql).not.toContain("GRANT CREATE ON SCHEMA bucket");
  });

  it("grants the four DML privileges on the bucket schema", () => {
    expect(sql).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA bucket TO "fn_role"'
    );
  });

  /** Bucket tables are created at runtime; without this every new bucket is invisible to a function. */
  it("grants privileges on future tables in the bucket schema too", () => {
    expect(sql).toContain(
      'ALTER DEFAULT PRIVILEGES IN SCHEMA bucket GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "fn_role"'
    );
  });

  it("grants read only on the spica schema", () => {
    expect(sql).toContain('GRANT SELECT ON ALL TABLES IN SCHEMA spica TO "fn_role"');
    expect(sql).not.toContain("INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA spica");
  });

  it("grants full privileges including DDL on the app schema", () => {
    expect(sql).toContain('GRANT USAGE, CREATE ON SCHEMA app TO "fn_role"');
    expect(sql).toContain('GRANT ALL ON ALL TABLES IN SCHEMA app TO "fn_role"');
  });

  /** A role name is an identifier, not a value: it cannot be bound as a parameter, it is quoted. */
  it("quotes the role name and doubles a quote inside it", () => {
    expect(quoteIdentifier('we"ird')).toBe('"we""ird"');
    expect(() => quoteIdentifier("")).toThrow();
  });

  it("extracts the role name from the URI", () => {
    expect(roleFromUri("postgres://fn_user:pw@host:5432/spica")).toBe("fn_user");
    expect(roleFromUri("postgres://host:5432/spica")).toBeUndefined();
    expect(roleFromUri(undefined)).toBeUndefined();
    expect(roleFromUri("not a uri")).toBeUndefined();
  });
});

/**
 * Verifying the privilege boundary **against real PostgreSQL**.
 *
 * Reading the produced SQL is not enough: a `GRANT`'s effect appears in PostgreSQL's own privilege model, and
 * "we did not grant CREATE" and "the role really cannot create a table" are separate claims. Because the
 * a security boundary, the second one is measured.
 */
const EXTERNAL_URL = process.env.POSTGRES_URL;
const maybe = EXTERNAL_URL ? describe : describe.skip;

maybe("the function role's real privileges", () => {
  const role = "spica_fn_test";
  let pool: Pool;

  const allowed = async (query: string) => {
    const {rows} = await pool.query<{allowed: boolean}>(query);
    return rows[0].allowed;
  };

  beforeAll(async () => {
    pool = new Pool({connectionString: EXTERNAL_URL});

    for (const statement of compileCreateSchemas()) {
      await runIdempotentDdl(pool, statement.sql, statement.params);
    }

    await pool.query(`DROP ROLE IF EXISTS ${quoteIdentifier(role)}`);
    await pool.query(`CREATE ROLE ${quoteIdentifier(role)} LOGIN PASSWORD 'test'`);

    // A bucket table to grant on: `ALL TABLES` covers the existing ones.
    await pool.query(
      `CREATE TABLE IF NOT EXISTS bucket."grant_probe" ("_id" char(24) PRIMARY KEY)`
    );
    await pool.query(`CREATE TABLE IF NOT EXISTS spica."grant_probe" ("_id" char(24) PRIMARY KEY)`);

    for (const statement of compileFunctionGrants(role)) {
      await runIdempotentDdl(pool, statement.sql, statement.params);
    }
  }, 60_000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DROP TABLE IF EXISTS bucket."grant_probe"`).catch(() => {});
    await pool.query(`DROP TABLE IF EXISTS spica."grant_probe"`).catch(() => {});
    await pool.query(`DROP OWNED BY ${quoteIdentifier(role)}`).catch(() => {});
    await pool.query(`DROP ROLE IF EXISTS ${quoteIdentifier(role)}`).catch(() => {});
    await pool.end();
  });

  it("can read and write bucket data", async () => {
    for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
      expect(
        await allowed(
          `SELECT has_table_privilege('${role}', 'bucket.grant_probe', '${privilege}') AS allowed`
        )
      ).toBe(true);
    }
  });

  // The boundary that matters: a function given raw SQL **cannot** create a bucket table.
  it("cannot create a table in the bucket schema", async () => {
    expect(
      await allowed(`SELECT has_schema_privilege('${role}', 'bucket', 'CREATE') AS allowed`)
    ).toBe(false);
  });

  it("can read a spica table but not write to it", async () => {
    expect(
      await allowed(
        `SELECT has_table_privilege('${role}', 'spica.grant_probe', 'SELECT') AS allowed`
      )
    ).toBe(true);

    for (const privilege of ["INSERT", "UPDATE", "DELETE"]) {
      expect(
        await allowed(
          `SELECT has_table_privilege('${role}', 'spica.grant_probe', '${privilege}') AS allowed`
        )
      ).toBe(false);
    }
  });

  it("can create a table in the app schema", async () => {
    expect(
      await allowed(`SELECT has_schema_privilege('${role}', 'app', 'CREATE') AS allowed`)
    ).toBe(true);
  });

  /**
   * The proof of `ALTER DEFAULT PRIVILEGES`: a bucket table created **after** the privileges were granted has
   * to be open to a function as well. Because bucket tables are created at runtime, without that rule every
   * new bucket stayed invisible to functions.
   */
  it("also sees a bucket table created after the privileges", async () => {
    await pool.query(`CREATE TABLE bucket."grant_probe_late" ("_id" char(24) PRIMARY KEY)`);
    try {
      expect(
        await allowed(
          `SELECT has_table_privilege('${role}', 'bucket.grant_probe_late', 'SELECT') AS allowed`
        )
      ).toBe(true);
    } finally {
      await pool.query(`DROP TABLE IF EXISTS bucket."grant_probe_late"`);
    }
  });
});
