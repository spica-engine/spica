import {DuplicateKeyError} from "@spica-server/data";
import {createPostgresDatabase} from "@spica-server/database-testing";
import pg from "pg";
import {defineEntity} from "../src/entity.js";
import {Orm} from "../src/session.js";
import {insertSql, updateSql} from "../src/sql.js";
import {createTables} from "../src/tables.js";

interface Doc {
  _id?: string;
  scope: string;
  hash?: string;
  count?: number;
  payload?: Record<string, unknown>;
}

const docs = defineEntity<Doc>({
  table: "docs",
  idProperty: "_id",
  columns: {
    scope: {type: "text", notNull: true},
    hash: {type: "text"},
    count: {type: "double precision"},
    seen: {type: "timestamptz", keepNull: true},
    payload: {type: "jsonb"}
  },
  indexes: [
    {columns: ["scope"], unique: true},
    {
      name: "docs_token_key",
      keys: ["nested.token"],
      expression: "(payload->>'token')",
      unique: true,
      where: "(payload->>'token') IS NOT NULL"
    }
  ]
});

describe("document entities", () => {
  describe("sql", () => {
    it("rejects unknown properties", () => {
      const strict = defineEntity({table: "strict", columns: {a: {type: "text"}}});
      expect(() => insertSql(strict, {b: 1})).toThrow(/no property "b"/);
    });

    it("reserves the id property", () => {
      expect(() =>
        defineEntity({table: "x", idProperty: "_id", columns: {_id: {type: "uuid"}}})
      ).toThrow(/implicit/);
    });

    it("rejects two properties mapping to the same column", () => {
      expect(() =>
        defineEntity({
          table: "x",
          columns: {a: {type: "text", column: "c"}, b: {type: "text", column: "c"}}
        })
      ).toThrow(/more than one property to column "c"/);
    });
  });

  describe("on PostgreSQL", () => {
    let pool: pg.Pool;
    let orm: Orm;

    beforeAll(async () => {
      pool = new pg.Pool({connectionString: await createPostgresDatabase()});
      orm = new Orm(pool);
      await createTables(pool, [docs]);
    });

    afterAll(() => pool.end());

    beforeEach(() => pool.query("TRUNCATE docs"));

    it("exposes the primary key under the configured property", async () => {
      const doc = await orm.insert(docs, {scope: "a"});
      expect(doc._id).toMatch(/^[0-9a-f-]{36}$/);
      expect(doc).not.toHaveProperty("id");
      expect(await orm.findById(docs, doc._id)).toEqual(doc);
      expect(await orm.deleteById(docs, doc._id)).toEqual(doc);
    });

    it("accepts a provided key", async () => {
      const _id = "01890a5d-ac96-774b-bcce-b302099a8057";
      expect(await orm.insert(docs, {_id, scope: "a"})).toMatchObject({_id});
    });

    it("returns null for NULL columns that ask to keep it", async () => {
      const doc = await orm.insert(docs, {scope: "a"});
      expect(doc.seen).toBeNull();
      expect(doc).not.toHaveProperty("count");
    });

    it("returns numbers for double precision columns", async () => {
      const {_id} = await orm.insert(docs, {scope: "a", count: 1700000000123});
      expect((await orm.findById(docs, _id)).count).toBe(1700000000123);
    });

    it("updates many rows and returns them", async () => {
      await orm.insertMany(docs, [
        {scope: "a", hash: "x"},
        {scope: "b", hash: "x"},
        {scope: "c", hash: "y"}
      ]);
      const before = await orm.updateMany(docs, {hash: "x"}, {hash: "z"}, {returning: "before"});
      expect(before.map(doc => doc.hash)).toEqual(["x", "x"]);
      expect(await orm.count(docs, {hash: "z"})).toBe(2);
    });

    it("reports the configured key names for violations of expression indexes", async () => {
      await orm.insert(docs, {scope: "a", payload: {token: "t"}});
      const error = await orm.insert(docs, {scope: "b", payload: {token: "t"}}).catch(e => e);
      expect(error).toBeInstanceOf(DuplicateKeyError);
      expect(error.keyValue).toEqual({"nested.token": "t"});
    });

    it("names columns in violations of plain unique indexes", async () => {
      await orm.insert(docs, {scope: "a"});
      const error = await orm.insert(docs, {scope: "a"}).catch(e => e);
      expect(error.keyValue).toEqual({scope: "a"});
    });
  });
});
