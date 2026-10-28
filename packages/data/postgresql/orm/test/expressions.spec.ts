import {createPostgresDatabase} from "@spica-server/database-testing";
import pg from "pg";
import {defineEntity} from "../src/entity.js";
import {
  addToSet,
  and,
  gte,
  has,
  increment,
  isNotNull,
  jsonbMerge,
  jsonbRemove,
  jsonbSet,
  lt,
  matches,
  notEquals,
  notMatches,
  or,
  pull,
  range,
  replacePrefix,
  startsWith,
  sum
} from "../src/expressions.js";
import {Orm, Session} from "../src/session.js";
import {createTables} from "../src/tables.js";

interface Thing {
  id: string;
  name: string;
  tags?: string[];
  refs?: string[];
  counter?: number;
  size?: number;
  doc?: Record<string, any>;
  at?: Date;
  note?: string;
}

const things = defineEntity<Thing>({
  table: "things",
  columns: {
    name: {type: "text", notNull: true},
    tags: {type: "text[]"},
    refs: {type: "uuid[]"},
    counter: {type: "integer"},
    size: {type: "double precision"},
    doc: {type: "jsonb"},
    at: {type: "timestamptz"},
    note: {type: "text"}
  },
  indexes: [{columns: ["name"], unique: true}]
});

const defaults = defineEntity<{
  id: string;
  labels: string[];
  settings: Record<string, unknown>;
  list: unknown[];
  count: number;
  flag: boolean;
  title: string;
}>({
  table: "defaults",
  columns: {
    labels: {type: "text[]", notNull: true, default: []},
    settings: {type: "jsonb", notNull: true, default: {}},
    list: {type: "jsonb", notNull: true, default: [{key: "it's"}]},
    count: {type: "double precision", notNull: true, default: 0},
    flag: {type: "boolean", notNull: true, default: true},
    title: {type: "text", notNull: true, default: "untitled"}
  }
});

const A = "01890a5d-ac96-774b-bcce-b302099a8057";
const B = "01890a5d-ac96-774b-bcce-b302099a8058";

describe("expressions", () => {
  let pool: pg.Pool;
  let orm: Orm;

  beforeAll(async () => {
    pool = new pg.Pool({connectionString: await createPostgresDatabase()});
    orm = new Orm(pool);
    await createTables(pool, [things, defaults]);
  });

  afterAll(() => pool.end());

  beforeEach(() => pool.query("TRUNCATE things, defaults"));

  const names = (rows: Thing[]) => rows.map(row => row.name).sort();

  describe("conditions", () => {
    beforeEach(async () => {
      await orm.insertMany(things, [
        {name: "a/b", tags: ["x"], refs: [A], size: 1, at: new Date("2024-01-01T00:00:00Z")},
        {
          name: "a/c/d",
          tags: ["x", "y"],
          refs: [A, B],
          size: 10,
          at: new Date("2024-02-01T00:00:00Z")
        },
        {name: "e", note: "n", at: new Date("2024-03-01T00:00:00Z")}
      ]);
    });

    it("matches rows that have a value", async () => {
      expect(names(await orm.findMany(things, {note: isNotNull()}))).toEqual(["e"]);
    });

    it("matches rows whose array contains a value", async () => {
      expect(names(await orm.findMany(things, {tags: has("y")}))).toEqual(["a/c/d"]);
      expect(names(await orm.findMany(things, {refs: has(A)}))).toEqual(["a/b", "a/c/d"]);
      expect(await orm.findMany(things, {refs: has(B), tags: has("z")})).toEqual([]);
    });

    it("rejects array conditions on other columns", async () => {
      await expect(orm.findMany(things, {name: has("a")})).rejects.toThrow(/not an array column/);
    });

    it("matches prefixes", async () => {
      expect(names(await orm.findMany(things, {name: startsWith("a/")}))).toEqual(["a/b", "a/c/d"]);
      expect(await orm.findMany(things, {name: startsWith("%")})).toEqual([]);
    });

    it("compares values and ranges", async () => {
      expect(names(await orm.findMany(things, {size: gte(10)}))).toEqual(["a/c/d"]);
      expect(names(await orm.findMany(things, {size: lt(10)}))).toEqual(["a/b"]);
      expect(
        names(
          await orm.findMany(things, {
            at: range(new Date("2024-01-01T00:00:00Z"), new Date("2024-03-01T00:00:00Z"))
          })
        )
      ).toEqual(["a/b", "a/c/d"]);
      expect(names(await orm.findMany(things, {name: notEquals("e")}))).toEqual(["a/b", "a/c/d"]);
    });

    it("matches regular expressions", async () => {
      expect(names(await orm.findMany(things, {name: matches("^a/[^/]+$")}))).toEqual(["a/b"]);
      expect(names(await orm.findMany(things, {name: notMatches("/")}))).toEqual(["e"]);
    });

    it("combines conditions with and, or", async () => {
      const where = or({name: "e"}, and({name: startsWith("a/")}, {size: gte(10)}));
      expect(names(await orm.findMany(things, where))).toEqual(["a/c/d", "e"]);
    });

    it("treats an empty and as everything and an empty or as nothing", async () => {
      expect(await orm.count(things, and())).toBe(3);
      expect(await orm.count(things, or())).toBe(0);
      expect(await orm.count(things, or({name: "e"}, and()))).toBe(3);
    });

    it("explains a group given as a property value", async () => {
      await expect(orm.findMany(things, {name: and({name: "e"})})).rejects.toThrow(
        /put the property inside and\(\.\.\.\) or or\(\.\.\.\)/
      );
    });

    it("refuses expressions as stored values", async () => {
      await expect(orm.insert(things, {name: "x", note: isNotNull() as any})).rejects.toThrow(
        /cannot store an expression/
      );
    });
  });

  describe("assignments", () => {
    it("adds to a set once and creates the array when missing", async () => {
      const {id} = await orm.insert(things, {name: "a"});
      await orm.updateById(things, id, {tags: addToSet("x")});
      await orm.updateById(things, id, {tags: addToSet("x")});
      await orm.updateById(things, id, {tags: addToSet("y")});
      expect((await orm.findById(things, id)).tags).toEqual(["x", "y"]);
    });

    it("adds typed values to uuid arrays", async () => {
      const {id} = await orm.insert(things, {name: "a"});
      await orm.updateById(things, id, {refs: addToSet(A)});
      await orm.updateById(things, id, {refs: addToSet(A)});
      expect((await orm.findById(things, id)).refs).toEqual([A]);
    });

    it("pulls a value and reports the previous row on request", async () => {
      const {id} = await orm.insert(things, {name: "a", tags: ["x", "y", "x"]});
      const before = await orm.updateById(things, id, {tags: pull("x")}, {returning: "before"});
      expect(before.tags).toEqual(["x", "y", "x"]);
      expect((await orm.findById(things, id)).tags).toEqual(["y"]);
    });

    it("increments, treating a missing number as zero", async () => {
      const {id} = await orm.insert(things, {name: "a"});
      await orm.updateById(things, id, {counter: increment(2)});
      expect((await orm.updateById(things, id, {counter: increment(3)})).counter).toBe(5);
    });

    it("replaces a leading prefix", async () => {
      const {id} = await orm.insert(things, {name: "old/file"});
      expect((await orm.updateById(things, id, {name: replacePrefix("old/", "new/")})).name).toBe(
        "new/file"
      );
    });

    it("leaves names without the prefix untouched", async () => {
      const {id} = await orm.insert(things, {name: "other/file"});
      expect((await orm.updateById(things, id, {name: replacePrefix("old/", "new/")})).name).toBe(
        "other/file"
      );
    });

    it("sets several json paths, creating the document when missing", async () => {
      const {id} = await orm.insert(things, {name: "a"});
      await orm.updateById(things, id, {doc: jsonbSet({"a.b": 1, c: "it's"})});
      expect((await orm.findById(things, id)).doc).toEqual({c: "it's"});

      await orm.updateById(things, id, {doc: jsonbSet({a: {b: 1}})});
      await orm.updateById(things, id, {doc: jsonbSet({"a.b": 2, "a.c": [1]})});
      expect((await orm.findById(things, id)).doc).toEqual({a: {b: 2, c: [1]}, c: "it's"});
    });

    it("merges json objects", async () => {
      const {id} = await orm.insert(things, {name: "a"});
      await orm.updateById(things, id, {doc: jsonbMerge({a: 1})});
      await orm.updateById(things, id, {doc: jsonbMerge({b: 2})});
      expect((await orm.findById(things, id)).doc).toEqual({a: 1, b: 2});
    });

    it("removes json paths", async () => {
      const {id} = await orm.insert(things, {name: "a", doc: {a: {b: 1, c: 2}, d: 3}});
      await orm.updateById(things, id, {doc: jsonbRemove(["a.b", "d", "missing.path"])});
      expect((await orm.findById(things, id)).doc).toEqual({a: {c: 2}});
    });

    it("rejects json expressions on other columns", async () => {
      const {id} = await orm.insert(things, {name: "a"});
      await expect(orm.updateById(things, id, {note: jsonbSet({a: 1})})).rejects.toThrow(
        /not a jsonb column/
      );
    });

    it("mixes expressions with plain values in one statement", async () => {
      const {id} = await orm.insert(things, {name: "a"});
      const updated = await orm.updateById(things, id, {note: "n", tags: addToSet("x")});
      expect(updated).toMatchObject({note: "n", tags: ["x"]});
    });
  });

  describe("upsert with expressions", () => {
    it("increments on conflict", async () => {
      const record = {name: "a", counter: 1};
      await orm.upsert(things, record, {conflict: ["name"], set: {counter: increment(1)}});
      await orm.upsert(things, record, {conflict: ["name"], set: {counter: increment(1)}});
      const upserted = await orm.upsert(things, record, {
        conflict: ["name"],
        set: {counter: increment(1)}
      });
      expect(upserted.counter).toBe(3);
      expect(await orm.count(things)).toBe(1);
    });

    it("combines copied columns with expressions", async () => {
      await orm.upsert(things, {name: "a", note: "one", counter: 1}, {conflict: ["name"]});
      const upserted = await orm.upsert(
        things,
        {name: "a", note: "two", counter: 1},
        {conflict: ["name"], update: ["note"], set: {counter: increment(5)}}
      );
      expect(upserted).toMatchObject({note: "two", counter: 6});
    });

    it("prefers an expression over a copied column", async () => {
      await orm.upsert(things, {name: "a", counter: 1}, {conflict: ["name"]});
      const upserted = await orm.upsert(
        things,
        {name: "a", counter: 100},
        {conflict: ["name"], update: ["counter"], set: {counter: increment(1)}}
      );
      expect(upserted.counter).toBe(2);
    });
  });

  describe("queries", () => {
    it("selects columns", async () => {
      await orm.insert(things, {name: "a", note: "n", size: 3});
      const [row] = await orm.findMany(things, {}, {select: ["name", "size"]});
      expect(row).toEqual({name: "a", size: 3});
      await expect(orm.findMany(things, {}, {select: ["nope"] as any})).rejects.toThrow(
        /no property/
      );
    });

    it("orders by a json path using the json ordering", async () => {
      await orm.insertMany(things, [
        {name: "a", doc: {size: 9}},
        {name: "b", doc: {size: 10}},
        {name: "c", doc: {size: 2}}
      ]);
      const ordered = await orm.findMany(things, {}, {orderBy: {"doc.size": "desc"}});
      expect(ordered.map(row => row.name)).toEqual(["b", "a", "c"]);
      await expect(orm.findMany(things, {}, {orderBy: {"name.size": "asc"}})).rejects.toThrow(
        /not a jsonb column/
      );
    });

    it("refuses an aggregate without aggregations", async () => {
      await expect(orm.aggregate(things, {})).rejects.toThrow(/at least one aggregation/);
    });

    it("types selected rows by the selected properties", async () => {
      await orm.insert(things, {name: "a", note: "n"});
      const row = await orm.findOne(things, {}, {select: ["name"]});
      const name: string = row.name;
      // @ts-expect-error the note was not selected
      const note = row.note;
      const rows = await orm.findMany(things, {}, {select: ["name", "size"]});
      const size: number | undefined = rows[0].size;
      const whole = await orm.findOne(things, {});
      const wholeNote: string | undefined = whole.note;
      expect([name, note, size, wholeNote]).toEqual(["a", undefined, undefined, "n"]);
    });

    it("sums columns and json paths, counting nothing as zero", async () => {
      expect(await orm.aggregate(things, {total: sum("size"), json: sum("doc.size")})).toEqual({
        total: 0,
        json: 0
      });
      await orm.insertMany(things, [
        {name: "a", size: 1.5, doc: {size: 2}},
        {name: "b", size: 2, doc: {size: 3}},
        {name: "c", size: 4}
      ]);
      expect(await orm.aggregate(things, {total: sum("size"), json: sum("doc.size")})).toEqual({
        total: 7.5,
        json: 5
      });
      expect(await orm.aggregate(things, {total: sum("size")}, {name: ["a", "c"]})).toEqual({
        total: 5.5
      });
    });
  });

  describe("deletes", () => {
    it("counts deleted rows without returning them", async () => {
      await orm.insertMany(things, [{name: "a/1"}, {name: "a/2"}, {name: "b"}]);
      expect(await orm.deleteWhere(things, {name: startsWith("a/")})).toBe(2);
      expect(await orm.deleteWhere(things, {name: "zzz"})).toBe(0);
      expect(await orm.count(things)).toBe(1);
    });

    it("refuses to delete without a condition", async () => {
      await orm.insert(things, {name: "a"});
      await expect(orm.deleteWhere(things, {})).rejects.toThrow(/needs a condition/);
      await expect(orm.deleteWhere(things, and())).rejects.toThrow(/needs a condition/);
      await expect(orm.deleteMany(things, and())).rejects.toThrow(/needs a condition/);
      expect(await orm.deleteWhere(things, or())).toBe(0);
      expect(await orm.count(things)).toBe(1);
    });
  });

  describe("locks", () => {
    it("blocks other writers on rows locked for update", async () => {
      const {id} = await orm.insert(things, {name: "a"});
      let release: () => void;
      const held = new Promise<void>(resolve => (release = resolve));
      const locked = orm.transaction(async session => {
        await session.findOne(things, {name: "a"}, {lock: "update"});
        await held;
      });
      await new Promise(resolve => setTimeout(resolve, 100));

      let finished = false;
      const writing = orm.updateById(things, id, {note: "x"}).then(() => (finished = true));
      await new Promise(resolve => setTimeout(resolve, 300));
      expect(finished).toBe(false);

      release();
      await locked;
      await writing;
      expect(finished).toBe(true);
    });

    it("skips locked rows on request", async () => {
      await orm.insertMany(things, [{name: "a"}, {name: "b"}]);
      let release: () => void;
      const held = new Promise<void>(resolve => (release = resolve));
      let firstTaken: Thing;
      const first = orm.transaction(async session => {
        firstTaken = await session.findOne(
          things,
          {},
          {orderBy: {name: "asc"}, lock: "update skip locked"}
        );
        await held;
      });
      await new Promise(resolve => setTimeout(resolve, 100));

      const second = await orm.transaction(session =>
        session.findOne(things, {}, {orderBy: {name: "asc"}, lock: "update skip locked"})
      );
      release();
      await first;
      expect(firstTaken.name).toBe("a");
      expect(second.name).toBe("b");
    });

    it("serializes transactions that take the same advisory lock", async () => {
      const order: string[] = [];
      let release: () => void;
      const held = new Promise<void>(resolve => (release = resolve));
      const first = orm.transaction(async session => {
        await session.lockTransaction("key");
        order.push("first");
        await held;
      });
      await new Promise(resolve => setTimeout(resolve, 100));

      const second = orm.transaction(async session => {
        await session.lockTransaction("key");
        order.push("second");
      });
      const unrelated = orm.transaction(async session => {
        await session.lockTransaction("other");
        order.push("unrelated");
      });
      await unrelated;
      expect(order).toEqual(["first", "unrelated"]);

      release();
      await Promise.all([first, second]);
      expect(order).toEqual(["first", "unrelated", "second"]);
    });

    it("takes a 64-bit hash of the lock name", async () => {
      const queries: string[] = [];
      const session = new Session({
        query: async (text: string) => {
          queries.push(text);
          return {rows: []} as any;
        }
      });
      await session.lockTransaction("key");
      expect(queries).toEqual(["SELECT pg_advisory_xact_lock(hashtextextended($1, 0))"]);
    });

    it("refuses transaction locks outside a transaction", async () => {
      await expect(orm.lockTransaction("key")).rejects.toThrow(/needs a transaction/);
    });
  });

  describe("defaults", () => {
    it("renders values as column defaults", async () => {
      const row = await orm.insert(defaults, {});
      expect(row).toMatchObject({
        labels: [],
        settings: {},
        list: [{key: "it's"}],
        count: 0,
        flag: true,
        title: "untitled"
      });
    });

    it("rejects defaults a column cannot hold", async () => {
      await expect(() =>
        createTables(pool, [
          defineEntity({table: "bad", columns: {labels: {type: "text[]", default: ["x"]}}})
        ])
      ).rejects.toThrow(/cannot default/);
    });
  });
});
