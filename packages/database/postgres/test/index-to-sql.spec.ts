import {describe, expect, it} from "@jest/globals";
import {TableSpec, UnsupportedCapabilityError} from "@spica-server/database-driver";
import {
  compileCreateIndex,
  compileDropIndex,
  deriveIndexName
} from "@spica-server/database-postgres";

const table: TableSpec = {
  collection: "bucket_67a1",
  columns: [
    {name: "title", kind: "text"},
    {name: "views", kind: "number"},
    {name: "tags", kind: "textArray"},
    {name: "scores", kind: "numberArray"},
    {name: "meta", kind: "json"}
  ]
};

describe("compileCreateIndex", () => {
  it("a single field index", () => {
    const {sql} = compileCreateIndex(table, {
      keys: [{field: "views", direction: 1}],
      name: "views_1"
    });
    expect(sql).toBe('CREATE INDEX IF NOT EXISTS "views_1" ON bucket."bucket_67a1" ("views" ASC)');
  });

  it("the field ORDER and direction are preserved in a compound index (R3)", () => {
    const {sql} = compileCreateIndex(table, {
      keys: [
        {field: "views", direction: -1},
        {field: "title", direction: 1}
      ],
      name: "views_-1_title_1"
    });
    expect(sql).toContain('("views" DESC, "title" ASC)');
  });

  it("unique", () => {
    const {sql} = compileCreateIndex(
      table,
      {keys: [{field: "title", direction: 1}]},
      {unique: true}
    );
    expect(sql).toContain("CREATE UNIQUE INDEX");
  });

  it("GIN is used on an array column (some/every only benefit from an index with GIN)", () => {
    expect(compileCreateIndex(table, {keys: [{field: "tags", direction: 1}]}).sql).toContain(
      "USING gin"
    );
    expect(compileCreateIndex(table, {keys: [{field: "scores", direction: 1}]}).sql).toContain(
      "USING gin"
    );
  });

  /**
   * The assertion that was missing: the earlier test only looked for `USING gin` in the string, so the
   * `ASC` sitting next to it went unnoticed and PostgreSQL rejected the statement at runtime
   * (`access method "gin" does not support ASC/DESC options`). A `toContain` on a fragment does not prove
   * the statement is valid; the real-database counterpart is in `contract-test/test/postgres.spec.ts`.
   */
  it("a GIN index carries no ordering option", () => {
    for (const direction of [1, -1] as const) {
      const {sql} = compileCreateIndex(table, {keys: [{field: "tags", direction}]});
      expect(sql).toContain("USING gin");
      expect(sql).not.toContain("ASC");
      expect(sql).not.toContain("DESC");
      expect(sql).toContain('("tags")');
    }
  });

  /**
   * MongoDB puts the index kind in the direction slot (`text`, `2dsphere`, `hashed`), and the contract's
   * `IndexDirection` is `1 | -1`. Read as "not -1" those all became **ascending**, so a text index quietly
   * turned into a plain btree one. A refusal by name is the only honest answer (K-4).
   */
  it("rejects an index kind that is not a direction", () => {
    for (const kind of ["text", "2dsphere", "2d", "hashed"]) {
      expect(() =>
        compileCreateIndex(table, {keys: [{field: "title", direction: kind as never}]})
      ).toThrow(UnsupportedCapabilityError);
    }
  });

  it("a scalar index keeps its ordering option", () => {
    expect(compileCreateIndex(table, {keys: [{field: "views", direction: -1}]}).sql).toContain(
      '"views" DESC'
    );
  });

  it("GIN is not used on a scalar column", () => {
    expect(compileCreateIndex(table, {keys: [{field: "views", direction: 1}]}).sql).not.toContain(
      "gin"
    );
  });

  it("GIN is not used on a compound index", () => {
    const {sql} = compileCreateIndex(table, {
      keys: [
        {field: "tags", direction: 1},
        {field: "views", direction: 1}
      ]
    });
    expect(sql).not.toContain("gin");
  });

  it("an index on _id is accepted", () => {
    expect(compileCreateIndex(table, {keys: [{field: "_id", direction: 1}]}).sql).toContain(
      '"_id"'
    );
  });

  /**
   * For an unnamed index the name is **derived** rather than left to PostgreSQL.
   *
   * The rationale was found through two attempts. `IF NOT EXISTS` makes a name mandatory in PostgreSQL: when
   * I added it unconditionally the unnamed path gave the syntax error `CREATE INDEX IF NOT EXISTS ON …`
   * (699 tests); when I left the unnamed path unprotected a catalog collision remained (18 tests), because
   * `passport/user`'s `email.hash`/`phone.hash` indexes are created without a name.
   *
   * The derived name has to be **deterministic** — otherwise `IF NOT EXISTS` provides no protection. The
   * pattern is the same as Spica's own `generateIndexName`: `field_direction`.
   */
  it("the name is derived for an unnamed index and it becomes idempotent", () => {
    const {sql} = compileCreateIndex(table, {keys: [{field: "views", direction: 1}]});
    expect(sql).toBe('CREATE INDEX IF NOT EXISTS "views_1" ON bucket."bucket_67a1" ("views" ASC)');
  });

  it("the derived name is deterministic and reflects the order in a compound index", () => {
    const spec = {
      keys: [
        {field: "views", direction: -1 as const},
        {field: "title", direction: 1 as const}
      ]
    };
    expect(deriveIndexName(spec)).toBe("views_-1_title_1");
    expect(deriveIndexName(spec)).toBe(deriveIndexName(spec));
  });

  it("dots in a nested path become underscores", () => {
    // `email.hash_1` looks like a schema qualification; it is flattened for readability.
    expect(deriveIndexName({keys: [{field: "email.hash", direction: 1}]})).toBe("email_hash_1");
  });

  it("a named index is idempotent too — so is Mongo's createIndex", () => {
    const {sql} = compileCreateIndex(table, {
      keys: [{field: "views", direction: 1}],
      name: "views_1"
    });
    expect(sql).toContain('INDEX IF NOT EXISTS "views_1"');
  });
});

describe("compileCreateIndex — what is unsupported does not stay SILENT (K-10)", () => {
  it("a compound sparse index is rejected — it has no single-column counterpart", () => {
    expect(() =>
      compileCreateIndex(
        table,
        {
          keys: [
            {field: "views", direction: 1},
            {field: "title", direction: 1}
          ]
        },
        {sparse: true}
      )
    ).toThrow(/compound sparse/);
  });

  it("collation is rejected", () => {
    expect(() =>
      compileCreateIndex(
        table,
        {keys: [{field: "title", direction: 1}]},
        {collation: {locale: "tr"}}
      )
    ).toThrow(/collation/);
  });

  it("expireAfterSeconds (TTL) is rejected — it is served by the sweeper", () => {
    expect(() =>
      compileCreateIndex(table, {keys: [{field: "views", direction: 1}]}, {expireAfterSeconds: 60})
    ).toThrow(/TTL/);
  });

  it("an index on a field that is not on the bucket is rejected", () => {
    expect(() => compileCreateIndex(table, {keys: [{field: "missing", direction: 1}]})).toThrow(
      /not a property of this bucket/
    );
  });

  it("an index with no keys is rejected", () => {
    expect(() => compileCreateIndex(table, {keys: []})).toThrow(/without keys/);
  });

  it("the error object carries the capability and the backend", () => {
    try {
      compileCreateIndex(
        table,
        {keys: [{field: "title", direction: 1}]},
        {collation: {locale: "tr"}}
      );
      throw new Error("the expected error was not raised");
    } catch (error: any) {
      expect(error.code).toBe("UNSUPPORTED_CAPABILITY");
      expect(error.backend).toBe("postgres");
      expect(error.capability).toContain("collation");
    }
  });
});

/**
 * `sparse` is turned into a partial index. My first decision was to reject it; the rationale was missing — in
 * a relational model "the field is absent" maps exactly to `NULL` (R41) and a partial index gives the same
 * thing.
 */
describe("compileCreateIndex — sparse", () => {
  it("a single field sparse index becomes a partial index", () => {
    const {sql} = compileCreateIndex(
      table,
      {keys: [{field: "views", direction: 1}]},
      {sparse: true}
    );
    expect(sql).toContain('WHERE "views" IS NOT NULL');
  });

  it("sparse and unique work together", () => {
    const {sql} = compileCreateIndex(
      table,
      {keys: [{field: "title", direction: 1}]},
      {sparse: true, unique: true}
    );
    expect(sql).toContain("CREATE UNIQUE INDEX");
    expect(sql).toContain('WHERE "title" IS NOT NULL');
  });
});

describe("compileDropIndex", () => {
  it("produces a schema-qualified DROP INDEX", () => {
    expect(compileDropIndex("views_1").sql).toBe('DROP INDEX bucket."views_1"');
  });
});
