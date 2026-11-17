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

const NOT_NULL_VIOLATION = "23502";

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
      expect(typeof (await orm.count(widgets))).toBe("number");
    });

    it("refuses undefined conditions instead of matching nothing", async () => {
      await expect(orm.findOne(widgets, {name: undefined})).rejects.toThrow(/undefined "name"/);
      await expect(orm.findMany(widgets, {name: undefined})).rejects.toThrow(/undefined "name"/);
      await expect(orm.count(widgets, {name: undefined})).rejects.toThrow(/undefined "name"/);
      await expect(orm.findById(widgets, undefined)).rejects.toThrow(/undefined "id"/);
      await expect(orm.deleteById(widgets, undefined)).rejects.toThrow(/undefined "id"/);
      await expect(orm.updateById(widgets, undefined, {note: "x"})).rejects.toThrow(
        /undefined "id"/
      );
      await expect(orm.replaceById(widgets, undefined, {name: "x"})).rejects.toThrow(
        /undefined "id"/
      );
      expect(await orm.count(widgets)).toBe(3);
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

    it("refuses to change the id", async () => {
      const widget = await orm.insert(widgets, {name: "a"});
      await expect(
        orm.updateById(widgets, widget.id, {id: "01890a5d-ac96-774b-bcce-b302099a8057", note: "x"})
      ).rejects.toThrow(/id of a "widgets" record cannot be changed/);
      await expect(
        orm.updateById(widgets, widget.id, {id: "01890a5d-ac96-774b-bcce-b302099a8057"})
      ).rejects.toThrow(/cannot be changed/);
    });

    it("treats an update that only repeats the id as a read", async () => {
      const widget = await orm.insert(widgets, {name: "a"});
      expect(await orm.updateById(widgets, widget.id, {id: widget.id})).toEqual(widget);
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

    it("refuses to delete many rows without a condition", async () => {
      await orm.insertMany(widgets, [{name: "a"}, {name: "b"}]);
      await expect(orm.deleteMany(widgets, {})).rejects.toThrow(/needs a condition/);
      expect(await orm.count(widgets)).toBe(2);
    });

    it("deletes every row on request", async () => {
      await orm.insertMany(widgets, [{name: "a"}, {name: "b"}]);
      expect(await orm.deleteAll(widgets)).toHaveLength(2);
      expect(await orm.count(widgets)).toBe(0);
    });
  });

  describe("upsert", () => {
    it("inserts and then updates on conflict", async () => {
      const first = await orm.upsert(widgets, {name: "a", note: "one"}, {conflict: ["name"]});
      const second = await orm.upsert(widgets, {name: "a", note: "two"}, {conflict: ["name"]});
      expect(second).toMatchObject({id: first.id, note: "two"});
      expect(await orm.count(widgets)).toBe(1);
    });

    it("keeps the stored id and conflict columns when the record carries others", async () => {
      const first = await orm.upsert(widgets, {name: "a", note: "one"}, {conflict: ["name"]});
      const second = await orm.upsert(
        widgets,
        {id: "01890a5d-ac96-774b-bcce-b302099a8057", name: "a", note: "two"},
        {conflict: ["name"]}
      );
      expect(second).toMatchObject({id: first.id, name: "a", note: "two"});
      expect(await orm.count(widgets)).toBe(1);
    });

    it("does not resolve a primary key collision that the conflict target omits", async () => {
      const taken = await orm.insert(widgets, {name: "a"});
      await expect(
        orm.upsert(widgets, {id: taken.id, name: "b"}, {conflict: ["name"]})
      ).rejects.toBeInstanceOf(DuplicateKeyError);
      expect(await orm.count(widgets)).toBe(1);
    });

    it("updates the row matched through the primary key when it is the conflict", async () => {
      const taken = await orm.insert(widgets, {name: "a", note: "one"});
      const upserted = await orm.upsert(
        widgets,
        {id: taken.id, name: "a", note: "two"},
        {conflict: ["id"]}
      );
      expect(upserted).toMatchObject({id: taken.id, note: "two"});
    });

    it("refuses an upsert without a conflict property", async () => {
      await expect(orm.upsert(widgets, {name: "a"}, {conflict: []})).rejects.toThrow(
        /needs at least one conflict property/
      );
    });

    it("refuses to update a property the record omits", async () => {
      await orm.insert(widgets, {name: "a", note: "keep"});
      await expect(
        orm.upsert(widgets, {name: "a"}, {conflict: ["name"], update: ["note"]})
      ).rejects.toThrow(/updates "note" but the record omits it/);
      expect((await orm.findOne(widgets, {name: "a"})).note).toBe("keep");
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

    it("keeps values that contain commas intact", async () => {
      await orm.insert(widgets, {name: "a, b"});
      const error = await orm.insert(widgets, {name: "a, b"}).catch(e => e);
      expect(error.keyValue).toEqual({name: "a, b"});
    });

    it("maps violations raised by updates", async () => {
      await orm.insert(widgets, {name: "a"});
      const {id} = await orm.insert(widgets, {name: "b"});
      await expect(orm.updateById(widgets, id, {name: "a"})).rejects.toBeInstanceOf(
        DuplicateKeyError
      );
    });

    it("rethrows other errors untouched", async () => {
      await expect(orm.insert(widgets, {note: "no name"})).rejects.toMatchObject({
        code: NOT_NULL_VIOLATION
      });
    });
  });

  describe("catalog", () => {
    afterEach(() =>
      pool.query('DROP TABLE IF EXISTS "Odd-Name", "catalog_a", "catalog_b", "other_c"')
    );

    it("tells whether a table exists", async () => {
      expect(await orm.tableExists("widgets")).toBe(true);
      expect(await orm.tableExists("nope")).toBe(false);
    });

    it("quotes the table name, so mixed case and dashes work", async () => {
      await pool.query('CREATE TABLE "Odd-Name" (id int)');

      expect(await orm.tableExists("Odd-Name")).toBe(true);
      expect(await orm.tableExists("odd-name")).toBe(false);
    });

    it("lists the tables that start with a prefix, in order", async () => {
      await pool.query(
        "CREATE TABLE catalog_b (id int); CREATE TABLE catalog_a (id int); CREATE TABLE other_c (id int)"
      );

      expect(await orm.tableNames({prefix: "catalog_"})).toEqual(["catalog_a", "catalog_b"]);
      expect(await orm.tableNames({prefix: "none"})).toEqual([]);
    });

    it("treats the underscore in a prefix literally", async () => {
      await pool.query("CREATE TABLE catalog_a (id int); CREATE TABLE catalogxa (id int)");

      try {
        expect(await orm.tableNames({prefix: "catalog_"})).toEqual(["catalog_a"]);
      } finally {
        await pool.query("DROP TABLE catalogxa");
      }
    });

    it("ignores the tables of other schemas", async () => {
      await pool.query(
        "CREATE SCHEMA IF NOT EXISTS elsewhere; CREATE TABLE elsewhere.catalog_a (id int)"
      );

      try {
        expect(await orm.tableNames({prefix: "catalog_"})).toEqual([]);
      } finally {
        await pool.query("DROP SCHEMA elsewhere CASCADE");
      }
    });

    it("lists every table without a prefix", async () => {
      expect(await orm.tableNames()).toContain("widgets");
    });

    it("runs the statements in order", async () => {
      await orm.executeStatements([
        "CREATE TABLE catalog_a (id int)",
        "INSERT INTO catalog_a VALUES (1)",
        "ALTER TABLE catalog_a ADD COLUMN note text",
        "UPDATE catalog_a SET note = 'x'"
      ]);

      const {rows} = await pool.query("SELECT id, note FROM catalog_a");
      expect(rows).toEqual([{id: 1, note: "x"}]);
    });

    it("stops at the first failing statement", async () => {
      await expect(
        orm.executeStatements([
          "CREATE TABLE catalog_a (id int)",
          "THIS IS NOT SQL",
          "CREATE TABLE catalog_b (id int)"
        ])
      ).rejects.toThrow();

      expect(await orm.tableExists("catalog_a")).toBe(true);
      expect(await orm.tableExists("catalog_b")).toBe(false);
    });

    it("rolls the statements back with the transaction", async () => {
      await expect(
        orm.transaction(async session => {
          await session.executeStatements(["CREATE TABLE catalog_a (id int)"]);
          expect(await session.tableExists("catalog_a")).toBe(true);
          throw new Error("abort");
        })
      ).rejects.toThrow("abort");

      expect(await orm.tableExists("catalog_a")).toBe(false);
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
        expect(small.idleCount).toBe(1);
        expect(small.waitingCount).toBe(0);

        await scoped.transaction(async session => session.count(widgets));
        expect(small.idleCount).toBe(1);
        expect(small.waitingCount).toBe(0);
      } finally {
        await small.end();
      }
    });

    it("destroys the connection when the rollback fails", async () => {
      const release = jest.fn();
      const client = {
        query: jest.fn(async (text: string) => {
          if (text == "ROLLBACK") {
            throw new Error("connection lost");
          }
          return {rows: []};
        }),
        release
      };
      const broken = new Orm({connect: async () => client} as unknown as pg.Pool);

      await expect(
        broken.transaction(async () => {
          throw new Error("x");
        })
      ).rejects.toThrow("x");
      expect(release).toHaveBeenCalledWith(true);
    });

    it("keeps healthy connections after a rollback", async () => {
      const release = jest.fn();
      const client = {query: jest.fn(async () => ({rows: []})), release};
      const healthy = new Orm({connect: async () => client} as unknown as pg.Pool);

      await expect(
        healthy.transaction(async () => {
          throw new Error("x");
        })
      ).rejects.toThrow("x");
      expect(release).toHaveBeenCalledWith(false);
    });
  });
});
