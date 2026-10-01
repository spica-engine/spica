import {afterEach, beforeEach, describe, expect, it} from "@jest/globals";
import {APP_SCHEMA, close, database} from "../src/postgres";

/**
 * These tests **open no connection**: the subject is under what conditions a connection is given at all
 *. The real query path is covered by the driver's contract tests and by `compileFunctionGrants`'s
 * own tests.
 */
describe("@spica-devkit/postgres — the conditions of a connection", () => {
  const saved = {...process.env};

  beforeEach(() => {
    process.env.RUNTIME = "node";
    delete process.env.__INTERNAL__SPICA__DATABASE_BACKEND__;
    delete process.env.__INTERNAL__SPICA__DATABASE_FUNCTIONS_URI__;
  });

  afterEach(async () => {
    await close();
    process.env = {...saved};
  });

  /**
   * The most important claim: when the role is absent the API's fully privileged connection is **not**
   * handed over, an error is raised. The privilege boundary prevents exactly that — raw SQL plus full
   * privileges can drop bucket tables.
   */
  it("refuses when the function role is not configured", async () => {
    await expect(database()).rejects.toThrow(/--database-functions-uri/);
  });

  it("the error message says the API connection is withheld deliberately", async () => {
    const error = await database().catch(e => e);
    expect(error.message).toContain("deliberately not handed to functions");
    expect(error.message).toContain(APP_SCHEMA);
  });

  it("redirects when the backend is MongoDB", async () => {
    process.env.__INTERNAL__SPICA__DATABASE_BACKEND__ = "mongodb";
    process.env.__INTERNAL__SPICA__DATABASE_FUNCTIONS_URI__ = "postgres://r:p@localhost:5432/spica";

    const error = await database().catch(e => e);
    expect(error.message).toContain("@spica-devkit/database");
    expect(error.message).toContain("@spica-devkit/bucket");
  });

  it("does not block when the backend is not declared (compatibility with older API versions)", async () => {
    process.env.__INTERNAL__SPICA__DATABASE_FUNCTIONS_URI__ = "postgres://r:p@localhost:5432/spica";
    const pool = await database();
    expect(pool).toBeTruthy();
  });

  /** One pool per process: a worker runs many calls in the same process. */
  it("gives the same pool again", async () => {
    process.env.__INTERNAL__SPICA__DATABASE_BACKEND__ = "postgres";
    process.env.__INTERNAL__SPICA__DATABASE_FUNCTIONS_URI__ = "postgres://r:p@localhost:5432/spica";

    const first = await database();
    const second = await database();
    expect(first).toBe(second);
  });

  it("gives a new pool after being closed", async () => {
    process.env.__INTERNAL__SPICA__DATABASE_BACKEND__ = "postgres";
    process.env.__INTERNAL__SPICA__DATABASE_FUNCTIONS_URI__ = "postgres://r:p@localhost:5432/spica";

    const first = await database();
    await close();
    const second = await database();
    expect(first).not.toBe(second);
  });
});
