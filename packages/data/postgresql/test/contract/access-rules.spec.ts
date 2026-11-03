import {Test, TestingModule} from "@nestjs/testing";
import {aggregate} from "@spica-server/bucket-expression";
import {compileRule, createStatements} from "@spica-server/data-postgresql";
import {quote} from "@spica-server/data-postgresql-orm";
import {contractSuite, DatabaseService} from "@spica-server/database-testing";
import {PG_POOL} from "@spica-server/interface-data";
import pg from "pg";
import {
  otherMetadata,
  relatedFor,
  ruleBucket,
  ruleMetadata,
  thirdMetadata
} from "../access/rule-fixtures";

const U = "0192f3a0-0000-7000-8000-0000000000c1";
const V = "0192f3a0-0000-7000-8000-0000000000c2";

const ids = {
  r1: "0192f3a0-0000-7000-8000-0000000000d1",
  r2: "0192f3a0-0000-7000-8000-0000000000d2",
  r3: "0192f3a0-0000-7000-8000-0000000000d3",
  r4: "0192f3a0-0000-7000-8000-0000000000d4"
};

const labels = Object.fromEntries(Object.entries(ids).map(([label, id]) => [id, label]));

const documents = [
  {id: ids.r1, title: "alpha", age: 30, owner: U, active: true, tags: ["a", "b"]},
  {id: ids.r2, title: "beta", age: 20, owner: V, active: false, tags: ["b"]},
  {id: ids.r3, tags: []},
  {id: ids.r4, title: "alpha", age: 25, owner: U, active: true, tags: []}
];

const all = ["r1", "r2", "r3", "r4"];

/**
 * Every rule here is one that both engines must answer alike. The rules come from the rules the
 * existing specs and the admin panel use, and from each built-in function.
 */
const corpus: [rule: string, auth: unknown, expected: string[]][] = [
  ["true==true", {}, all],
  ["document.owner == auth._id", {_id: U}, ["r1", "r4"]],
  ["document.owner != auth._id", {_id: U}, ["r2", "r3"]],
  ["auth.role == 'admin'", {role: "admin"}, all],
  ["auth.role == 'admin'", {role: "user"}, []],
  ["auth.identifier != 'noop'", {identifier: "someone"}, all],
  ["auth.identifier != 'noop'", {identifier: "noop"}, []],
  ["document.age > 24", {}, ["r1", "r4"]],
  ["!(document.age > 24)", {}, ["r2", "r3"]],
  ["document.age >= 25 && document.title == 'alpha'", {}, ["r1", "r4"]],
  ["document.title != 'alpha'", {}, ["r2", "r3"]],
  ["document.owner == auth._id || auth.role == 'admin'", {_id: U, role: "user"}, ["r1", "r4"]],
  ["document.owner == auth._id || auth.role == 'admin'", {_id: U, role: "admin"}, all],
  [
    "document.age > 24 ? document.title == 'alpha' : document.title == 'beta'",
    {},
    ["r1", "r2", "r4"]
  ],
  ["has(document.title)", {}, ["r1", "r2", "r4"]],
  ["!(has(document.title))", {}, ["r3"]],
  ["some(document.tags, ['a'])", {}, ["r1"]],
  ["some(document.tags, ['b', 'z'])", {}, ["r1", "r2"]],
  ["every(document.tags, ['a', 'b'])", {}, ["r1"]],
  ["every(document.tags, ['b'])", {}, ["r1", "r2"]],
  ["equal(document.tags, ['b'])", {}, ["r2"]],
  ["equal(document.tags, [])", {}, ["r3", "r4"]],
  ["length(document.tags) == 2", {}, ["r1"]],
  ["length(document.tags) > 0", {}, ["r1", "r2"]],
  ['regex(document.title, "^al")', {}, ["r1", "r4"]]
];

contractSuite("access rules", engine => {
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({imports: [engine.module()]}).compile();
    await module.init();

    if (engine.name == "mongodb") {
      const collection = module.get(DatabaseService).collection("access_rule_cases");
      await collection.deleteMany({});
      await collection.insertMany(
        documents.map(({id, ...fields}) => ({_id: id as never, ...fields}))
      );
      return;
    }

    const pool = module.get<pg.Pool>(PG_POOL);
    for (const metadata of [thirdMetadata, otherMetadata, ruleMetadata]) {
      for (const statement of createStatements(metadata)) {
        await pool.query(statement);
      }
    }
    for (const {id, tags, ...columns} of documents) {
      const names = Object.keys({id, ...columns});
      await pool.query(
        `INSERT INTO ${quote(ruleMetadata.main.name)} (${names.map(quote).join(", ")})
         VALUES (${names.map((_, index) => `$${index + 1}`).join(", ")})`,
        Object.values({id, ...columns})
      );
      const child = ruleMetadata.tables.find(table => table.path.join(".") == "tags")!.name;
      for (const [position, tag] of tags.entries()) {
        await pool.query(
          `INSERT INTO ${quote(child)} ("_parent", "_position", "_value") VALUES ($1, $2, $3)`,
          [id, position, tag]
        );
      }
    }
  }, 120_000);

  afterAll(() => module.close());

  async function select(rule: string, auth: unknown): Promise<string[]> {
    if (engine.name == "mongodb") {
      const found = await module
        .get(DatabaseService)
        .collection("access_rule_cases")
        .aggregate([{$match: aggregate(rule, {auth}, "match")}])
        .toArray();
      return found.map(document => labels[document._id as unknown as string]).sort();
    }

    const values: unknown[] = [];
    const related = await relatedFor(rule);
    const {sql, joins} = compileRule(
      rule,
      {bucket: ruleBucket, metadata: ruleMetadata, auth, table: "t", related},
      values
    );
    const {rows} = await module
      .get<pg.Pool>(PG_POOL)
      .query(
        `SELECT "t"."id" FROM ${quote(ruleMetadata.main.name)} AS "t" ${joins.join(" ")} WHERE ${sql}`,
        values
      );
    return rows.map(row => labels[row.id]).sort();
  }

  it.each(corpus)("should select the same rows for %s with %j", async (rule, auth, expected) => {
    expect(await select(rule, auth)).toEqual(expected);
  });

  describe("known differences", () => {
    it("should treat a field with no value as null on PostgreSQL only", async () => {
      expect(await select("document.title == null", {})).toEqual(
        engine.name == "mongodb" ? [] : ["r3"]
      );
    });
  });
});
