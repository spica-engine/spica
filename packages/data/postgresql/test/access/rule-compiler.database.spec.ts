import {Test, TestingModule} from "@nestjs/testing";
import {hash} from "@spica-server/core-encryption";
import {
  applyVisibility,
  compileFieldRules,
  compileRule,
  createStatements,
  visibilitySelect
} from "@spica-server/data-postgresql";
import {quote} from "@spica-server/data-postgresql-orm";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {PG_POOL} from "@spica-server/interface-data";
import pg from "pg";
import {
  otherMetadata,
  relatedFor,
  ruleBucket,
  ruleMetadata,
  thirdMetadata,
  uuid,
  withFieldRules
} from "./rule-fixtures";

const SECRET = "secret";
const OTHER_OWNER = "0192f3a0-0000-7000-8000-00000000000b";

const ids = {
  r1: "0192f3a0-0000-7000-8000-000000000001",
  r2: "0192f3a0-0000-7000-8000-000000000002",
  r3: "0192f3a0-0000-7000-8000-000000000003",
  r4: "0192f3a0-0000-7000-8000-000000000004"
};

const labels = Object.fromEntries(Object.entries(ids).map(([label, id]) => [id, label]));

const o1 = "0192f3a0-0000-7000-8000-0000000000a1";
const o2 = "0192f3a0-0000-7000-8000-0000000000a2";
const t1 = "0192f3a0-0000-7000-8000-0000000000b1";

type Row = Record<string, unknown>;

const thirdRows: Row[] = [{id: t1, title: "ceo", rank: 1}];

const otherRows: Row[] = [
  {
    id: o1,
    name: "ann",
    level: 3,
    joined: "2024-03-01T00:00:00Z",
    pin: hash("1234", SECRET),
    boss: t1
  },
  {id: o2, name: "bob", level: 1, joined: "2022-01-01T00:00:00Z"}
];

const rows: Row[] = [
  {
    id: ids.r1,
    title: "alpha",
    age: 30,
    count: 5,
    big: "9007199254740993",
    active: true,
    created: "2024-06-01T00:00:00Z",
    owner: uuid,
    password: hash("pw", SECRET),
    address__city: "Ankara",
    author: o1
  },
  {
    id: ids.r2,
    title: "beta",
    age: 20,
    count: 10,
    big: "5",
    active: false,
    created: "2023-01-01T00:00:00Z",
    owner: OTHER_OWNER,
    address__city: "Izmir",
    author: o2
  },
  {id: ids.r3},
  {id: ids.r4, title: "alpha", age: 25, count: 0, active: true, owner: uuid}
];

type Metadata = typeof ruleMetadata;

const childRows: [Metadata, string, string, unknown[]][] = [
  [ruleMetadata, "tags", ids.r1, ["a", "b"]],
  [ruleMetadata, "tags", ids.r2, ["b"]],
  [ruleMetadata, "scores", ids.r1, [1, 2, 3]],
  [ruleMetadata, "docs", ids.r1, ['{"k":1}', "[1,2]"]],
  [ruleMetadata, "editors", ids.r1, [o1, o2]],
  [ruleMetadata, "editors", ids.r2, [o2]],
  [otherMetadata, "tags", o1, ["x"]]
];

describe("compileRule on PostgreSQL", () => {
  let module: TestingModule;
  let pool: pg.Pool;
  const table = ruleMetadata.main.name;

  async function insert(into: string, records: Row[]) {
    for (const record of records) {
      const columns = Object.keys(record);
      await pool.query(
        `INSERT INTO ${quote(into)} (${columns.map(quote).join(", ")})
         VALUES (${columns.map((_, index) => `$${index + 1}`).join(", ")})`,
        Object.values(record)
      );
    }
  }

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.postgres()]
    }).compile();
    await module.init();
    pool = module.get(PG_POOL);

    for (const metadata of [thirdMetadata, otherMetadata, ruleMetadata]) {
      for (const statement of createStatements(metadata)) {
        await pool.query(statement);
      }
    }

    await insert(thirdMetadata.main.name, thirdRows);
    await insert(otherMetadata.main.name, otherRows);
    await insert(table, rows);

    for (const [metadata, path, parent, values] of childRows) {
      const child = metadata.tables.find(candidate => candidate.path.join(".") == path)!.name;
      const element = metadata.columnOf(path.split("."))!.name;
      for (const [position, value] of values.entries()) {
        await pool.query(
          `INSERT INTO ${quote(child)} ("_parent", "_position", ${quote(element)}) VALUES ($1, $2, $3)`,
          [parent, position, value]
        );
      }
    }
  }, 120_000);

  afterAll(() => module.close());

  async function select(rule: string, auth: unknown) {
    const values: unknown[] = [];
    const related = await relatedFor(rule);
    const {sql, joins} = compileRule(
      rule,
      {bucket: ruleBucket, metadata: ruleMetadata, auth, hashSecret: SECRET, table: "t", related},
      values
    );
    const {rows: found} = await pool.query(
      `SELECT "t"."id" FROM ${quote(table)} AS "t" ${joins.join(" ")} WHERE ${sql} ORDER BY "t"."id"`,
      values
    );
    return found.map(row => labels[row.id]);
  }

  const all = ["r1", "r2", "r3", "r4"];

  const cases: [string, unknown, string[]][] = [
    ["true==true", {}, all],
    ["true==false", {}, []],
    ["document.title == 'alpha'", {}, ["r1", "r4"]],
    ["document.title != 'alpha'", {}, ["r2", "r3"]],
    ["document.title == null", {}, ["r3"]],
    ["document.title != null", {}, ["r1", "r2", "r4"]],
    ["document.age > 24", {}, ["r1", "r4"]],
    ["!(document.age > 24)", {}, ["r2", "r3"]],
    ["document.age > 24 && document.active", {}, ["r1", "r4"]],
    ["document.active", {}, ["r1", "r4"]],
    ["!(document.active == true)", {}, ["r2", "r3"]],
    ["document.owner == auth._id", {_id: uuid}, ["r1", "r4"]],
    ["document.owner != auth._id", {_id: uuid}, ["r2", "r3"]],
    ["document.owner == auth._id", {}, ["r3"]],
    ["document.owner == auth._id || auth.role == 'admin'", {_id: uuid, role: "admin"}, all],
    ["document.owner == auth._id || auth.role == 'admin'", {_id: uuid, role: "user"}, ["r1", "r4"]],
    ["document.created > '2024-01-01T00:00:00.000Z'", {}, ["r1"]],
    ["document.password == 'pw'", {}, ["r1"]],
    ["document.address.city == 'Ankara'", {}, ["r1"]],
    ["document.count % 2 == 0", {}, ["r2", "r4"]],
    ["document.count / 2 > 2", {}, ["r1", "r2"]],
    ["document.count * 3 > document.age", {}, ["r2"]],
    ["document.count / document.count > 0", {}, ["r1", "r2"]],
    ["document.count > 1 ? document.active : document.title == 'alpha'", {}, ["r1", "r4"]],
    ["document.big == '9007199254740993'", {}, ["r1"]],
    ["document.big > document.count", {}, ["r1"]],
    ["document.owner == document.title", {}, ["r3"]],
    ["document.owner == auth._id", {_id: "not-a-uuid"}, []],
    ["document.owner != auth._id", {_id: "not-a-uuid"}, all],
    ["document.author == auth._id", {_id: uuid}, []],
    ["document.count == 1 || true", {}, all],

    ["has(document.title)", {}, ["r1", "r2", "r4"]],
    ["!(has(document.title))", {}, ["r3"]],
    ["has(document.tags)", {}, ["r1", "r2"]],
    ["has(document.address.city)", {}, ["r1", "r2"]],
    ["some(document.tags, ['a'])", {}, ["r1"]],
    ["some(document.tags, ['b', 'z'])", {}, ["r1", "r2"]],
    ["some(document.tags, ['z'])", {}, []],
    ["!(some(document.tags, ['a']))", {}, ["r2", "r3", "r4"]],
    ["some(document.tags, auth.roles)", {roles: ["z", "a"]}, ["r1"]],
    ["every(document.tags, ['a', 'b'])", {}, ["r1"]],
    ["every(document.tags, ['b'])", {}, ["r1", "r2"]],
    ["every(document.tags, ['a', 'z'])", {}, []],
    ["every(document.tags, [])", {}, all],
    ["equal(document.tags, ['b'])", {}, ["r2"]],
    ["equal(document.tags, ['b', 'a'])", {}, ["r1"]],
    ["equal(document.tags, [])", {}, ["r3", "r4"]],
    ["length(document.tags) == 2", {}, ["r1"]],
    ["length(document.tags) == 0", {}, ["r3", "r4"]],
    ["length(document.tags) > 0", {}, ["r1", "r2"]],
    ["length(document.title) > 4", {}, ["r1", "r4"]],
    ["some(document.scores, [2, 9])", {}, ["r1"]],
    ["every(document.scores, [1, 2, 3])", {}, ["r1"]],
    ["some(document.scores, [3000000000])", {}, []],
    ["some(document.docs, [[1, 2]])", {}, ["r1"]],
    ["some(document.docs, [[2, 1]])", {}, []],
    ["some(document.tags, ['a']) || document.owner == auth._id", {_id: OTHER_OWNER}, ["r1", "r2"]],
    ['regex(document.title, "^al")', {}, ["r1", "r4"]],
    ['regex(document.title, "^AL")', {}, []],
    ['regex(document.title, "^AL", "i")', {}, ["r1", "r4"]],
    ['!(regex(document.title, "^al"))', {}, ["r2", "r3"]],
    ["unixTime(document.created) > 1700000000", {}, ["r1"]],
    ["unixTime(document.created) < now()", {}, ["r1", "r2"]],

    ["document.author.name == 'ann'", {}, ["r1"]],
    ["document.author.name != 'ann'", {}, ["r2", "r3", "r4"]],
    ["document.author.id == auth.o", {o: o2}, ["r2"]],
    ["document.author.boss.title == 'ceo'", {}, ["r1"]],
    ["document.author.level > 1", {}, ["r1"]],
    ["!(document.author.level > 1)", {}, ["r2", "r3", "r4"]],
    ["document.author.name == 'ann' || document.author.level == 1", {}, ["r1", "r2"]],
    ["document.author.boss == null", {}, ["r2", "r3", "r4"]],
    ["document.author.joined > '2023-01-01T00:00:00Z'", {}, ["r1"]],
    ["document.author.pin == '1234'", {}, ["r1"]],
    ["has(document.author.name)", {}, ["r1", "r2"]],
    ["some(document.author.tags, ['x'])", {}, ["r1"]],
    ["document.author.name == 'ann' || true", {}, all],
    ["document.author.name == 'bob' && document.owner != auth._id", {_id: uuid}, ["r2"]],
    ["some(document.editors.id, [auth.o])", {o: o2}, ["r1", "r2"]],
    ["some(document.editors.name, ['ann'])", {}, ["r1"]],
    ["every(document.editors.name, ['ann', 'bob'])", {}, ["r1"]],
    ["equal(document.editors.id, [auth.o])", {o: o2}, ["r2"]],
    ["length(document.editors) == 2", {}, ["r1"]]
  ];

  it.each(cases)("should select the rows %s allows for %j", async (rule, auth, expected) => {
    expect(await select(rule, auth)).toEqual(expected);
  });

  describe("field level rules", () => {
    const rules = {
      title: "document.age > 24",
      count: "auth.role == 'admin'",
      big: "document.author.level > 1",
      owner: "false==true"
    };

    async function visibleKeys(auth: unknown) {
      const bucket = withFieldRules(rules);
      const related = await relatedFor(Object.values(rules));
      const values: unknown[] = [];
      const fields = compileFieldRules(
        {bucket, metadata: ruleMetadata, auth, table: "t", related},
        values
      );
      const flags = visibilitySelect(fields);
      const {rows: found} = await pool.query(
        `SELECT "t"."id"${flags.map(flag => `, ${flag}`).join("")} FROM ${quote(table)} AS "t" ${fields.joins.join(" ")} ORDER BY "t"."id"`,
        values
      );
      const document = {age: 1, title: "t", count: 1, big: "1", owner: "o"};
      return Object.fromEntries(
        found.map(row => [
          labels[row.id],
          Object.keys(applyVisibility(document, row, fields)).sort()
        ])
      );
    }

    it("should hide the fields a rule denies, record by record", async () => {
      expect(await visibleKeys({role: "admin"})).toEqual({
        r1: ["age", "big", "count", "title"],
        r2: ["age", "count"],
        r3: ["age", "count"],
        r4: ["age", "count", "title"]
      });
    });

    it("should hide a field for everybody when the rule is decided by the caller", async () => {
      expect(await visibleKeys({role: "user"})).toEqual({
        r1: ["age", "big", "title"],
        r2: ["age"],
        r3: ["age"],
        r4: ["age", "title"]
      });
    });
  });
});
