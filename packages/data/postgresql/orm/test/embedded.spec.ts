import {DuplicateKeyError} from "@spica-server/data";
import {createPostgresDatabase} from "@spica-server/database-testing";
import pg from "pg";
import {defineEntity} from "../src/entity.js";
import {isNotNull, now, sum} from "../src/expressions.js";
import {Orm} from "../src/session.js";
import {createIndexSql, createTableSql, fromRow, insertSql} from "../src/sql.js";
import {createTables} from "../src/tables.js";

interface Person {
  id: string;
  name: string;
  email?: {encrypted?: string; authTag?: string; hash?: string};
  geo?: {point?: {lat?: number; lng?: number}; label?: string};
  createdAt: Date;
}

const people = defineEntity<Person>({
  table: "people",
  columns: {
    name: {type: "text", notNull: true},
    email: {
      embedded: {
        encrypted: {type: "text"},
        authTag: {type: "text"},
        hash: {type: "text"}
      }
    },
    geo: {
      embedded: {
        point: {embedded: {lat: {type: "double precision"}, lng: {type: "double precision"}}},
        label: {type: "text"}
      }
    },
    createdAt: {type: "timestamptz", notNull: true, default: now()}
  },
  indexes: [{columns: ["email.hash"], unique: true}]
});

interface Token {
  id: string;
  userId: string;
  code?: string;
  used: boolean;
  requests?: number;
}

const tokens = defineEntity<Token>({
  table: "tokens",
  columns: {
    userId: {type: "text", notNull: true},
    code: {type: "text"},
    used: {type: "boolean", notNull: true, default: false},
    requests: {type: "integer"}
  },
  indexes: [{columns: ["userId"], unique: true, where: {used: false}}]
});

describe("embedded columns", () => {
  describe("sql", () => {
    it("prefixes embedded columns with their parents", () => {
      expect(createTableSql(people)).toBe(
        'CREATE TABLE IF NOT EXISTS "people" ("id" uuid PRIMARY KEY NOT NULL DEFAULT uuidv7(), "name" text NOT NULL, "email_encrypted" text, "email_auth_tag" text, "email_hash" text, "geo_point_lat" double precision, "geo_point_lng" double precision, "geo_label" text, "created_at" timestamptz NOT NULL DEFAULT now())'
      );
      expect(people.indexes.map(index => createIndexSql(people, index))).toEqual([
        'CREATE UNIQUE INDEX IF NOT EXISTS "people_email_hash_key" ON "people" USING btree ("email_hash")'
      ]);
    });

    it("flattens objects into columns, and null clears the whole group", () => {
      expect(insertSql(people, {name: "a", email: {hash: "h"}, geo: {point: {lat: 1}}})).toEqual({
        text: 'INSERT INTO "people" ("name", "email_hash", "geo_point_lat") VALUES ($1, $2, $3) RETURNING *',
        values: ["a", "h", 1]
      });
      expect(insertSql(people, {name: "a", geo: null as any}).text).toBe(
        'INSERT INTO "people" ("name", "geo_point_lat", "geo_point_lng", "geo_label") VALUES ($1, $2, $3, $4) RETURNING *'
      );
    });

    it("rebuilds nested objects and omits empty groups", () => {
      expect(
        fromRow(people, {name: "a", email_hash: "h", geo_point_lat: 1, geo_label: null})
      ).toEqual({name: "a", email: {hash: "h"}, geo: {point: {lat: 1}}});
    });

    it("rejects unknown embedded properties and non-objects", () => {
      expect(() => insertSql(people, {name: "a", email: {nope: 1}} as any)).toThrow(
        /no property "email.nope"/
      );
      expect(() => insertSql(people, {name: "a", email: "x"} as any)).toThrow(/object or null/);
    });

    it("keeps embedded columns nullable", () => {
      expect(() =>
        defineEntity({
          table: "x",
          columns: {g: {embedded: {a: {type: "text", notNull: true}}}}
        })
      ).toThrow(/must be nullable/);
    });
  });

  describe("on PostgreSQL", () => {
    let pool: pg.Pool;
    let orm: Orm;

    beforeAll(async () => {
      pool = new pg.Pool({connectionString: await createPostgresDatabase()});
      orm = new Orm(pool);
      await createTables(pool, [people, tokens]);
    });

    afterAll(() => pool.end());

    beforeEach(() => pool.query("TRUNCATE people, tokens"));

    it("round-trips nested objects and fills defaults", async () => {
      const person = await orm.insert(people, {
        name: "a",
        email: {encrypted: "e", authTag: "t", hash: "h"},
        geo: {point: {lat: 1.5, lng: 2}}
      });
      expect(person).toMatchObject({
        name: "a",
        email: {encrypted: "e", authTag: "t", hash: "h"},
        geo: {point: {lat: 1.5, lng: 2}}
      });
      expect(person.createdAt).toBeInstanceOf(Date);
      expect(await orm.findById(people, person.id)).toEqual(person);
    });

    it("omits a group whose columns are all NULL", async () => {
      const person = await orm.insert(people, {name: "a"});
      expect(person).not.toHaveProperty("email");
      expect(person).not.toHaveProperty("geo");
    });

    it("updates parts of a group, a dotted property, or clears the group", async () => {
      const {id} = await orm.insert(people, {name: "a", email: {encrypted: "e", hash: "h"}});

      expect((await orm.updateById(people, id, {email: {hash: "h2"}})).email).toEqual({
        encrypted: "e",
        hash: "h2"
      });
      expect((await orm.updateById(people, id, {"email.encrypted": "e2"} as any)).email).toEqual({
        encrypted: "e2",
        hash: "h2"
      });
      expect(await orm.updateById(people, id, {email: null})).not.toHaveProperty("email");
    });

    it("resets groups a replacement omits", async () => {
      const {id} = await orm.insert(people, {name: "a", email: {hash: "h"}});
      const replaced = await orm.replaceById(people, id, {name: "b", geo: {label: "l"}});
      expect(replaced).toMatchObject({name: "b", geo: {label: "l"}});
      expect(replaced).not.toHaveProperty("email");
    });

    it("filters, orders, sums and selects dotted properties", async () => {
      await orm.insertMany(people, [
        {name: "a", email: {hash: "h1"}, geo: {point: {lat: 3}}},
        {name: "b", email: {hash: "h2"}, geo: {point: {lat: 10}}},
        {name: "c"}
      ]);

      expect((await orm.findOne(people, {"email.hash": "h2"})).name).toBe("b");
      expect((await orm.findMany(people, {"email.hash": isNotNull()})).length).toBe(2);
      expect(
        (await orm.findMany(people, {}, {orderBy: {"geo.point.lat": "desc"}})).map(p => p.name)
      ).toEqual(["c", "b", "a"]);
      expect(await orm.aggregate(people, {lat: sum("geo.point.lat")})).toEqual({lat: 13});

      const [selected] = await orm.findMany(people, {name: "a"}, {
        select: ["name", "email"]
      } as any);
      expect(selected).toEqual({name: "a", email: {hash: "h1"}});
    });

    it("reports the dotted property in unique violations and allows missing values", async () => {
      await orm.insert(people, {name: "a"});
      await orm.insert(people, {name: "b"});
      await orm.insert(people, {name: "c", email: {hash: "h"}});

      const error = await orm.insert(people, {name: "d", email: {hash: "h"}}).catch(e => e);

      expect(error).toBeInstanceOf(DuplicateKeyError);
      expect(error.keyValue).toEqual({"email.hash": "h"});
    });

    it("upserts a whole group", async () => {
      await orm.upsert(
        people,
        {name: "a", email: {encrypted: "e", hash: "h"}},
        {conflict: ["email.hash"], update: ["email", "name"]}
      );
      const upserted = await orm.upsert(
        people,
        {name: "b", email: {encrypted: "e2", hash: "h"}},
        {conflict: ["email.hash"], update: ["email", "name"]}
      );
      expect(upserted).toMatchObject({name: "b", email: {encrypted: "e2", hash: "h"}});
      expect(await orm.count(people)).toBe(1);
    });
  });

  describe("partial indexes", () => {
    let pool: pg.Pool;
    let orm: Orm;

    beforeAll(async () => {
      pool = new pg.Pool({connectionString: await createPostgresDatabase()});
      orm = new Orm(pool);
      await createTables(pool, [tokens]);
    });

    afterAll(() => pool.end());

    beforeEach(() => pool.query("TRUNCATE tokens"));

    it("creates the index with a rendered predicate", async () => {
      const {rows} = await pool.query(
        "SELECT indexdef FROM pg_indexes WHERE indexname = 'tokens_user_id_key'"
      );
      expect(rows[0].indexdef).toMatch(/UNIQUE.*\(user_id\) WHERE \(?used = false\)?/);
    });

    it("upserts against the partial unique index", async () => {
      const pending = {userId: "u", code: "1", used: false, requests: 1};
      const options = {
        conflict: ["userId"],
        conflictWhere: {used: false},
        update: ["code"]
      };
      await orm.upsert(tokens, pending, options);
      const second = await orm.upsert(tokens, {...pending, code: "2"}, options);

      expect(second).toMatchObject({code: "2"});
      expect(await orm.count(tokens)).toBe(1);

      await orm.updateById(tokens, second.id, {used: true});
      await orm.upsert(tokens, pending, options);
      expect(await orm.count(tokens)).toBe(2);
    });
  });
});
