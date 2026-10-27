import {defineEntity} from "../src/entity.js";
import {
  createIndexSql,
  createTableSql,
  insertManySql,
  insertSql,
  replaceSql,
  selectSql,
  updateSql,
  upsertSql
} from "../src/sql.js";

const widgets = defineEntity({
  table: "widgets",
  columns: {
    name: {type: "text", notNull: true},
    failedAttempts: {type: "timestamptz[]"},
    settings: {type: "jsonb"},
    tags: {type: "text[]"}
  },
  indexes: [
    {columns: ["name"], unique: true},
    {columns: ["tags"], using: "gin"},
    {name: "widgets_lower_name_idx", expression: "lower(name)", where: "name IS NOT NULL"}
  ]
});

describe("sql builders", () => {
  describe("defineEntity", () => {
    it("adds a uuidv7 id primary key and snake_cases property names", () => {
      expect(createTableSql(widgets)).toBe(
        'CREATE TABLE IF NOT EXISTS "widgets" ("id" uuid PRIMARY KEY NOT NULL DEFAULT uuidv7(), "name" text NOT NULL, "failed_attempts" timestamptz[], "settings" jsonb, "tags" text[])'
      );
    });

    it("rejects an explicit id column", () => {
      expect(() => defineEntity({table: "x", columns: {id: {type: "uuid"}}})).toThrow(/implicit/);
    });

    it("rejects an index on an unknown property", () => {
      expect(() =>
        defineEntity({table: "x", columns: {}, indexes: [{columns: ["missing"]}]})
      ).toThrow(/unknown property/);
    });

    it("requires a name for expression indexes", () => {
      expect(() =>
        defineEntity({table: "x", columns: {}, indexes: [{expression: "lower(a)"}]})
      ).toThrow(/needs a name/);
    });

    it("rejects index names longer than PostgreSQL allows", () => {
      expect(() =>
        defineEntity({
          table: "x",
          columns: {},
          indexes: [{name: "a".repeat(64), expression: "1"}]
        })
      ).toThrow(/longer than 63/);
    });
  });

  describe("createIndexSql", () => {
    it("renders unique, gin and partial expression indexes", () => {
      expect(widgets.indexes.map(index => createIndexSql(widgets, index))).toEqual([
        'CREATE UNIQUE INDEX IF NOT EXISTS "widgets_name_key" ON "widgets" USING btree ("name")',
        'CREATE INDEX IF NOT EXISTS "widgets_tags_idx" ON "widgets" USING gin ("tags")',
        'CREATE INDEX IF NOT EXISTS "widgets_lower_name_idx" ON "widgets" USING btree (lower(name)) WHERE name IS NOT NULL'
      ]);
    });
  });

  describe("insertSql", () => {
    it("omits undefined properties so column defaults apply", () => {
      expect(insertSql(widgets, {name: "a", tags: undefined})).toEqual({
        text: 'INSERT INTO "widgets" ("name") VALUES ($1) RETURNING *',
        values: ["a"]
      });
    });

    it("uses DEFAULT VALUES for an empty record", () => {
      expect(insertSql(widgets, {}).text).toBe('INSERT INTO "widgets" DEFAULT VALUES RETURNING *');
    });

    it("serializes jsonb values but keeps arrays native", () => {
      const {values} = insertSql(widgets, {settings: [1, 2], tags: ["a", "b"]});
      expect(values).toEqual(["[1,2]", ["a", "b"]]);
    });

    it("rejects unknown properties", () => {
      expect(() => insertSql(widgets, {nope: 1})).toThrow(/no property "nope"/);
    });
  });

  describe("insertManySql", () => {
    it("fills missing properties with DEFAULT across rows", () => {
      expect(insertManySql(widgets, [{id: "1", name: "a"}, {name: "b"}])).toEqual({
        text: 'INSERT INTO "widgets" ("id", "name") VALUES ($1, $2), (DEFAULT, $3) RETURNING *',
        values: ["1", "a", "b"]
      });
    });

    it("inserts default rows when no record has properties", () => {
      expect(insertManySql(widgets, [{}, {}]).text).toBe(
        'INSERT INTO "widgets" ("id") VALUES (DEFAULT), (DEFAULT) RETURNING *'
      );
    });
  });

  describe("updateSql", () => {
    it("returns the new row by default and the old row on request", () => {
      expect(updateSql(widgets, "1", {name: "b"}, "after")).toEqual({
        text: 'UPDATE "widgets" SET "name" = $1 WHERE "id" = $2 RETURNING *',
        values: ["b", "1"]
      });
      expect(updateSql(widgets, "1", {name: "b"}, "before").text).toMatch(/RETURNING old\.\*$/);
    });

    it("sets null explicitly and skips undefined", () => {
      expect(updateSql(widgets, "1", {tags: null, name: undefined}, "after").values).toEqual([
        null,
        "1"
      ]);
    });

    it("refuses an update that changes nothing", () => {
      expect(() => updateSql(widgets, "1", {name: undefined}, "after")).toThrow(
        /Nothing to update/
      );
    });
  });

  describe("replaceSql", () => {
    it("resets missing properties to their defaults", () => {
      expect(replaceSql(widgets, "1", {name: "a"}, "after")).toEqual({
        text: 'UPDATE "widgets" SET "name" = $1, "failed_attempts" = DEFAULT, "settings" = DEFAULT, "tags" = DEFAULT WHERE "id" = $2 RETURNING *',
        values: ["a", "1"]
      });
    });
  });

  describe("selectSql", () => {
    it("builds equality, ANY, IS NULL and array equality conditions", () => {
      expect(selectSql(widgets, {name: ["a", "b"], settings: null, tags: ["x"]})).toEqual({
        text: 'SELECT * FROM "widgets" WHERE "name" = ANY($1) AND "settings" IS NULL AND "tags" = $2',
        values: [["a", "b"], ["x"]]
      });
    });

    it("matches nothing for an empty IN list", () => {
      expect(selectSql(widgets, {name: []}).text).toBe('SELECT * FROM "widgets" WHERE FALSE');
    });

    it("orders, limits and offsets with bound parameters", () => {
      expect(selectSql(widgets, {}, {orderBy: {name: "desc"}, limit: 5, offset: 10})).toEqual({
        text: 'SELECT * FROM "widgets" ORDER BY "name" DESC LIMIT $1 OFFSET $2',
        values: [5, 10]
      });
    });
  });

  describe("upsertSql", () => {
    it("updates provided non-key columns on conflict", () => {
      expect(upsertSql(widgets, {name: "a", tags: ["x"]}, {conflict: ["name"]})).toEqual({
        text: 'INSERT INTO "widgets" ("name", "tags") VALUES ($1, $2) ON CONFLICT ("name") DO UPDATE SET "tags" = EXCLUDED."tags" RETURNING *',
        values: ["a", ["x"]]
      });
    });

    it("does nothing on conflict when there is nothing to update", () => {
      expect(upsertSql(widgets, {name: "a"}, {conflict: ["name"]}).text).toMatch(
        /ON CONFLICT \("name"\) DO NOTHING RETURNING \*$/
      );
    });

    it("supports a partial unique index as the conflict target", () => {
      expect(
        upsertSql(
          widgets,
          {name: "a"},
          {conflict: ["name"], conflictWhere: "tags IS NULL", update: ["tags"]}
        ).text
      ).toMatch(/ON CONFLICT \("name"\) WHERE tags IS NULL DO UPDATE SET "tags" = EXCLUDED."tags"/);
    });
  });
});
