import {DuplicateKeyError} from "@spica-server/data";
import {createPostgresDatabase} from "@spica-server/database-testing";
import pg from "pg";
import {defineEntity} from "../src/entity.js";
import {Orm} from "../src/session.js";
import {createTables} from "../src/tables.js";

interface Widget {
  id: string;
  name: string;
  note?: string;
  tags?: string[];
  settings?: {nested: {value: number}[]};
  seenAt?: Date[];
  createdAt: Date;
}

const widgets = defineEntity<Widget>({
  table: "widgets",
  columns: {
    name: {type: "text", notNull: true},
    note: {type: "text"},
    tags: {type: "text[]"},
    settings: {type: "jsonb"},
    seenAt: {type: "timestamptz[]"},
    createdAt: {type: "timestamptz", notNull: true, default: "now()"}
  },
  indexes: [{columns: ["name"], unique: true}]
});

describe("Orm", () => {
  let pool: pg.Pool;
  let orm: Orm;

  beforeAll(async () => {
    pool = new pg.Pool({connectionString: await createPostgresDatabase()});
    orm = new Orm(pool);
    await createTables(pool, [widgets]);
  });

  afterAll(() => pool.end());

  beforeEach(() => pool.query("TRUNCATE widgets"));

  describe("ids", () => {
    it("generates a uuid v7 when none is provided", async () => {
      const widget = await orm.insert(widgets, {name: "a"});
      expect(widget.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
    });

    it("accepts a provided id", async () => {
      const id = "01890a5d-ac96-774b-bcce-b302099a8057";
      const widget = await orm.insert(widgets, {id, name: "a"});
      expect(widget.id).toBe(id);
      expect(await orm.findById(widgets, id)).toEqual(widget);
    });

    it("generates ids that sort by insertion order", async () => {
      const inserted = [];
      for (const name of ["a", "b", "c"]) {
        inserted.push(await orm.insert(widgets, {name}));
      }
      const ids = inserted.map(widget => widget.id);
      expect([...ids].sort()).toEqual(ids);
    });
  });

  describe("mapping", () => {
    it("round-trips jsonb, arrays and timestamps", async () => {
      const seenAt = [new Date("2024-01-01T00:00:00Z"), new Date("2024-02-01T00:00:00Z")];
      const settings = {nested: [{value: 1}, {value: 2}]};
      const {id} = await orm.insert(widgets, {name: "a", tags: ["x", "y"], settings, seenAt});

      expect(await orm.findById(widgets, id)).toMatchObject({
        name: "a",
        tags: ["x", "y"],
        settings,
        seenAt
      });
    });

    it("stores a jsonb array as jsonb, not as a PostgreSQL array", async () => {
      const {id} = await orm.insert(widgets, {name: "a", settings: [{value: 1}] as any});
      expect((await orm.findById(widgets, id)).settings).toEqual([{value: 1}]);
    });

    it("omits null columns from records and applies column defaults", async () => {
      const widget = await orm.insert(widgets, {name: "a"});
      expect(Object.keys(widget).sort()).toEqual(["createdAt", "id", "name"]);
      expect(widget.createdAt).toBeInstanceOf(Date);
    });

    it("applies column conversion hooks in both directions", async () => {
      const upper = defineEntity<{id: string; name: string}>({
        table: "widgets",
        columns: {
          name: {type: "text", toDb: v => String(v).toUpperCase(), fromDb: v => `${v}!`}
        }
      });
      expect(await orm.insert(upper, {name: "abc"})).toMatchObject({name: "ABC!"});
    });

    it("rejects unknown properties", async () => {
      await expect(orm.insert(widgets, {nope: 1} as any)).rejects.toThrow(/no property "nope"/);
    });
  });

  describe("queries", () => {
    beforeEach(async () => {
      await orm.insertMany(widgets, [
        {name: "a", tags: ["x"]},
        {name: "b", tags: ["x", "y"]},
        {name: "c"}
      ]);
    });

    it("inserts many records in one statement", async () => {
      expect(await orm.count(widgets)).toBe(3);
      expect(await orm.insertMany(widgets, [])).toEqual([]);
    });

    it("finds by equality, IN lists, null and array equality", async () => {
      expect((await orm.findOne(widgets, {name: "a"})).name).toBe("a");
      expect(
        (await orm.findMany(widgets, {name: ["a", "c"]}, {orderBy: {name: "asc"}})).map(w => w.name)
      ).toEqual(["a", "c"]);
      expect((await orm.findMany(widgets, {tags: null})).map(w => w.name)).toEqual(["c"]);
      expect((await orm.findMany(widgets, {tags: ["x", "y"]})).map(w => w.name)).toEqual(["b"]);
      expect(await orm.findMany(widgets, {name: []})).toEqual([]);
    });

    it("orders, limits and offsets", async () => {
      const page = await orm.findMany(widgets, {}, {orderBy: {name: "desc"}, limit: 1, offset: 1});
      expect(page.map(w => w.name)).toEqual(["b"]);
    });

    it("returns null when nothing matches", async () => {
      expect(await orm.findOne(widgets, {name: "zzz"})).toBeNull();
      expect(await orm.findById(widgets, "01890a5d-ac96-774b-bcce-b302099a8057")).toBeNull();
    });

    it("counts matching rows", async () => {
      expect(await orm.count(widgets, {tags: null})).toBe(1);
    });
  });

  describe("updates", () => {
    it("returns the row after the update by default", async () => {
      const {id} = await orm.insert(widgets, {name: "a", note: "old"});
      expect(await orm.updateById(widgets, id, {note: "new"})).toMatchObject({
        name: "a",
        note: "new"
      });
    });

    it("returns the row before the update on request", async () => {
      const {id} = await orm.insert(widgets, {name: "a", note: "old"});
      expect(await orm.updateById(widgets, id, {note: "new"}, {returning: "before"})).toMatchObject(
        {note: "old"}
      );
      expect((await orm.findById(widgets, id)).note).toBe("new");
    });

    it("clears a column with null and ignores undefined", async () => {
      const {id} = await orm.insert(widgets, {name: "a", note: "old"});
      const updated = await orm.updateById(widgets, id, {note: null, name: undefined});
      expect(updated.note).toBeUndefined();
      expect(updated.name).toBe("a");
    });

    it("treats an update with no changes as a read", async () => {
      const widget = await orm.insert(widgets, {name: "a"});
      expect(await orm.updateById(widgets, widget.id, {})).toEqual(widget);
    });

    it("returns null when the row does not exist", async () => {
      expect(
        await orm.updateById(widgets, "01890a5d-ac96-774b-bcce-b302099a8057", {note: "x"})
      ).toBeNull();
    });

    it("replaces a row, resetting omitted columns to their defaults", async () => {
      const {id} = await orm.insert(widgets, {name: "a", note: "old", tags: ["x"]});
      const replaced = await orm.replaceById(widgets, id, {name: "b"});
      expect(replaced).toMatchObject({id, name: "b"});
      expect(replaced.note).toBeUndefined();
      expect(replaced.tags).toBeUndefined();
    });

    it("returns the row before a replacement on request", async () => {
      const {id} = await orm.insert(widgets, {name: "a", note: "old"});
      expect(await orm.replaceById(widgets, id, {name: "b"}, {returning: "before"})).toMatchObject({
        name: "a",
        note: "old"
      });
    });
  });

  describe("deletes", () => {
    it("returns the deleted row", async () => {
      const {id} = await orm.insert(widgets, {name: "a"});
      expect(await orm.deleteById(widgets, id)).toMatchObject({id, name: "a"});
      expect(await orm.deleteById(widgets, id)).toBeNull();
    });

    it("deletes many rows by condition", async () => {
      await orm.insertMany(widgets, [{name: "a"}, {name: "b"}, {name: "c"}]);
      const deleted = await orm.deleteMany(widgets, {name: ["a", "b"]});
      expect(deleted).toHaveLength(2);
      expect(await orm.count(widgets)).toBe(1);
    });
  });

  describe("upsert", () => {
    it("inserts and then updates on conflict", async () => {
      const first = await orm.upsert(widgets, {name: "a", note: "one"}, {conflict: ["name"]});
      const second = await orm.upsert(widgets, {name: "a", note: "two"}, {conflict: ["name"]});
      expect(second).toMatchObject({id: first.id, note: "two"});
      expect(await orm.count(widgets)).toBe(1);
    });

    it("returns null when the conflict is ignored", async () => {
      await orm.upsert(widgets, {name: "a"}, {conflict: ["name"]});
      expect(await orm.upsert(widgets, {name: "a"}, {conflict: ["name"]})).toBeNull();
    });
  });

  describe("duplicate keys", () => {
    it("maps unique violations to DuplicateKeyError with property names", async () => {
      await orm.insert(widgets, {name: "a"});
      const error = await orm.insert(widgets, {name: "a"}).catch(e => e);
      expect(error).toBeInstanceOf(DuplicateKeyError);
      expect(error.keyValue).toEqual({name: "a"});
    });

    it("maps violations raised by updates", async () => {
      await orm.insert(widgets, {name: "a"});
      const {id} = await orm.insert(widgets, {name: "b"});
      await expect(orm.updateById(widgets, id, {name: "a"})).rejects.toBeInstanceOf(
        DuplicateKeyError
      );
    });

    it("rethrows other errors untouched", async () => {
      await expect(orm.insert(widgets, {note: "no name"})).rejects.toMatchObject({code: "23502"});
    });
  });

  describe("transactions", () => {
    it("commits when the work resolves", async () => {
      await orm.transaction(async session => {
        await session.insert(widgets, {name: "a"});
        await session.insert(widgets, {name: "b"});
      });
      expect(await orm.count(widgets)).toBe(2);
    });

    it("rolls back when the work rejects", async () => {
      await expect(
        orm.transaction(async session => {
          await session.insert(widgets, {name: "a"});
          throw new Error("boom");
        })
      ).rejects.toThrow("boom");
      expect(await orm.count(widgets)).toBe(0);
    });

    it("rolls back after a failed statement and reports the original error", async () => {
      await orm.insert(widgets, {name: "a"});
      await expect(
        orm.transaction(async session => {
          await session.insert(widgets, {name: "b"});
          await session.insert(widgets, {name: "a"});
        })
      ).rejects.toBeInstanceOf(DuplicateKeyError);
      expect(await orm.count(widgets)).toBe(1);
    });

    it("hides uncommitted work from other connections", async () => {
      let countOutside: number;
      await orm.transaction(async session => {
        await session.insert(widgets, {name: "a"});
        countOutside = await orm.count(widgets);
        expect(await session.count(widgets)).toBe(1);
      });
      expect(countOutside).toBe(0);
    });

    it("shares one transaction between the ORM and raw SQL", async () => {
      await expect(
        orm.transaction(async session => {
          await session.insert(widgets, {name: "a"});
          await session.raw("ALTER TABLE widgets ADD COLUMN extra text");
          await session.raw("INSERT INTO widgets (name, extra) VALUES ('b', 'raw')");
          throw new Error("undo everything");
        })
      ).rejects.toThrow("undo everything");

      expect(await orm.count(widgets)).toBe(0);
      const {rows} = await pool.query(
        "SELECT 1 FROM information_schema.columns WHERE table_name = 'widgets' AND column_name = 'extra'"
      );
      expect(rows).toHaveLength(0);
    });

    it("reuses the surrounding transaction for nested calls", async () => {
      await expect(
        orm.transaction(async outer => {
          await outer.insert(widgets, {name: "a"});
          await outer.transaction(async inner => {
            expect(inner).toBe(outer);
            await inner.insert(widgets, {name: "b"});
          });
          throw new Error("rollback outer");
        })
      ).rejects.toThrow("rollback outer");
      expect(await orm.count(widgets)).toBe(0);
    });

    it("releases the connection after the work finishes", async () => {
      const small = new pg.Pool({connectionString: pool.options.connectionString, max: 1});
      try {
        const scoped = new Orm(small);
        await expect(
          scoped.transaction(async () => {
            throw new Error("x");
          })
        ).rejects.toThrow("x");
        await scoped.transaction(async session => session.count(widgets));
      } finally {
        await small.end();
      }
    });
  });
});
