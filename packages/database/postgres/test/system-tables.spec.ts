import {describe, expect, it} from "@jest/globals";
import {
  createCodec,
  OVERFLOW_COLUMN,
  SYSTEM_SCHEMA,
  systemSchema,
  systemTable,
  systemTables
} from "@spica-server/database-postgres";

/**
 * The system table registry (AK-8).
 *
 * What is really verified: **two artifacts come out of one definition** and the two are consistent. Had the
 * table definition and the codec been written separately, a field present in one and absent from the other
 * would be silent data loss.
 */
describe("system tables", () => {
  it("recognizes the known collections and not an unknown one", () => {
    expect(systemTable("buckets")).toBeDefined();
    expect(systemTable("identity")).toBeDefined();
    expect(systemTable("bucket_67a1b2c3d4e5f60718293a4b")).toBeUndefined();
    expect(systemTable("nope")).toBeUndefined();
  });

  it("the table name takes NO prefix and is in the spica schema", () => {
    const table = systemTable("buckets")!;
    // `bucketToTable` normally produces `bucket_<id>`; a system table has to carry a plain name.
    expect(table.collection).toBe("buckets");
    expect(table.namespace).toBe(SYSTEM_SCHEMA);
  });

  it("the collection that opened D4 resolves", () => {
    // `bucket/common/src/crud.ts` calls `collection("buckets")`; without that resolving it blew up on PG.
    expect(systemSchema("buckets")).toBeTruthy();
    expect(systemTable("buckets")).toBeTruthy();
  });

  it("every TTL collection that opened D3 is registered", () => {
    // The seven services that call `upsertTTLIndex`.
    for (const name of [
      "activity",
      "status",
      "function_logs",
      "webhook_logs",
      "verification",
      "jobs",
      "commands"
    ]) {
      expect(systemTable(name)).toBeDefined();
    }
  });

  it("the TTL collections carry created_at — the sweeper uses it", () => {
    for (const name of ["activity", "status", "function_logs", "webhook_logs", "verification"]) {
      const table = systemTable(name)!;
      const column = table.columns.find(c => c.name === "created_at");
      expect(column).toBeTruthy();
      expect(column!.kind).toBe("timestamp");
    }
  });

  it("R12: produces real columns, it does not put everything into a single jsonb", () => {
    const identity = systemTable("identity")!;
    const kinds = new Map(identity.columns.map(c => [c.name, c.kind]));

    expect(kinds.get("identifier")).toBe("text");
    expect(kinds.get("password")).toBe("text");
    expect(kinds.get("deactivateJwtsBefore")).toBe("number");
    expect(kinds.get("policies")).toBe("textArray");
    expect(kinds.get("lastLogin")).toBe("timestamp");
    // A field that really is nested is jsonb.
    expect(kinds.get("authFactor")).toBe("json");
    // The overflow column: a safety net for undeclared fields, not the place for known ones.
    expect(kinds.get(OVERFLOW_COLUMN)).toBe("json");
  });

  /**
   * The overflow column has to exist on **every** system table.
   *
   * The schemas were written by hand and a hand-written schema can be incomplete — on my first attempt my
   * `preferences`, `config` and `identity` definitions did not match the real data model. Without the
   * overflow a field that was not declared **disappears silently** on write.
   */
  it("every system table has an overflow column", () => {
    for (const table of systemTables()) {
      expect(table.overflowColumn).toBe(OVERFLOW_COLUMN);
      expect(table.columns.map(c => c.name)).toContain(OVERFLOW_COLUMN);
    }
  });

  it("an undeclared field goes out and comes back through the overflow", () => {
    const schema = systemSchema("preferences")!;
    const codec = createCodec(schema, {overflow: OVERFLOW_COLUMN});

    // `Preference` carries `[key: string]: any`; `property` is not declared in the schema.
    const {row} = codec.toRow({scope: "passport", property: "passport property"});
    expect(row.scope).toBe("passport");
    expect(row[OVERFLOW_COLUMN]).toEqual({property: "passport property"});

    const document = codec.toDocument(row);
    expect(document.scope).toBe("passport");
    // It is spread back onto the top level; the caller does not know the overflow exists.
    expect(document.property).toBe("passport property");
    expect(document[OVERFLOW_COLUMN]).toBeUndefined();
  });

  it("an undeclared field is not written to the row when there is no overflow", () => {
    const schema = systemSchema("preferences")!;
    const codec = createCodec(schema);
    const {row} = codec.toRow({scope: "passport", property: "kaybolur"});
    expect(row[OVERFLOW_COLUMN]).toBeUndefined();
    expect(row.property).toBeUndefined();
  });

  it("_id is NOT in the column list — an implicit primary key", () => {
    for (const table of systemTables()) {
      expect(table.columns.map(c => c.name)).not.toContain("_id");
    }
  });

  it("the table definition and the codec agree on the same fields", () => {
    for (const table of systemTables()) {
      const schema = systemSchema(table.collection)!;
      const codec = createCodec(schema, {overflow: table.overflowColumn});

      const document: Record<string, any> = {};
      for (const column of table.columns) {
        if (column.name === OVERFLOW_COLUMN) continue;
        document[column.name] = column.kind === "timestamp" ? new Date() : null;
      }

      const {row} = codec.toRow(document);
      // Every column has to find its counterpart in the row; a field that does not would disappear silently.
      for (const column of table.columns) {
        expect(Object.keys(row)).toContain(column.name);
      }
    }
  });

  it("all of them have unique names and none has an empty definition", () => {
    const tables = systemTables();
    const names = tables.map(t => t.collection);
    expect(new Set(names).size).toBe(names.length);
    for (const table of tables) {
      expect(table.columns.length).toBeGreaterThan(0);
    }
  });
});
