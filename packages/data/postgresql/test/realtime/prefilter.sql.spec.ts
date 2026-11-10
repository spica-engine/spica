import {Test, TestingModule} from "@nestjs/testing";
import {provideRepository} from "@spica-server/data";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {BUCKET_SCHEMA_MANAGER, BucketSchemaManager} from "@spica-server/interface-bucket";
import {
  BUCKET_QUERY,
  BUCKET_WRITE,
  BucketQueryFacade,
  BucketWriteFacade
} from "@spica-server/interface-bucket-common";
import {prefilterOf} from "../../src/realtime/prefilter.js";

const DOCUMENTS = [
  {name: "alice", nick: "alice", age: 20, score: 0.1, active: true},
  {name: "Alice", nick: "alice", age: 5, score: 0.30000000000000004, active: false},
  {name: "bob", nick: "robert", age: 0, score: 0, active: true},
  {name: "", nick: "", age: -1, score: -1.5},
  {name: " alice", age: 20.5, active: false},
  {name: "alice ", nick: "alice", score: 0.1},
  {name: "élan", nick: "élan", age: 1e21},
  {name: "élan", age: 20},
  {name: "a%b", nick: "a_b", age: 5, active: true},
  {nick: "bob", age: 20},
  {age: 5, score: 5},
  {active: true},
  {name: "zed", nick: "zed", age: 21, score: 20, active: false},
  {}
];

const FILTERS = [
  `document.name == "alice"`,
  `document.name != "alice"`,
  `document.name == ""`,
  `document.name == "Alice"`,
  `document.name == "alice "`,
  `document.name == "élan"`,
  `document.name == "élan"`,
  `document.name == "a%b"`,
  `document.name == document.nick`,
  `document.name != document.nick`,
  `name == "alice"`,
  `document.age == 20`,
  `document.age != 20`,
  `document.age == 20.5`,
  `document.age > 5`,
  `document.age >= 5`,
  `document.age < 20`,
  `document.age <= 20.5`,
  `document.age == 0`,
  `document.age < 0`,
  `document.age > document.score`,
  `document.score == 0.1`,
  `document.score > 0.1`,
  `document.score == 0`,
  `document.active == true`,
  `document.active == false`,
  `document.active != true`,
  `!(document.active == true)`,
  `!(document.age > 5)`,
  `!(document.name == "alice")`,
  `document.name == "alice" && document.age > 5`,
  `document.name == "alice" && document.active == true`,
  `document.name == "alice" || document.age > 5`,
  `document.name == "alice" || document.active == true`,
  `document.name == "zed" || document.name == "bob"`,
  `document.name in ["alice", "bob"]`,
  `document.age in [5, 20]`,
  `document.active ? document.age > 5 : document.age < 5`,
  `document.name == "alice" ? document.age > 1 : document.age > 100`,
  `document.name == "alice" ? true : false`,
  `document.age == "20"`,
  `document.name == 5`,
  `document.active == "true"`,
  `document.name > "a"`,
  `document.nick == "alice" && document.name == "Alice"`
];

const RULES: [string, unknown][] = [
  [`document.name == auth.name`, {name: "alice"}],
  [`document.name == auth.name`, {name: "Alice"}],
  [`document.name == auth.name`, {name: "zed"}],
  [`document.name == auth.name`, {}],
  [`document.name == auth.name`, {name: null}],
  [`document.name == auth.name`, {name: ""}],
  [`document.age > auth.minAge`, {minAge: 5}],
  [`document.age > auth.minAge`, {minAge: -5}],
  [`document.age == auth.age`, {age: 20}],
  [`auth.admin == true || document.active == true`, {admin: false}],
  [`auth.admin == true || document.active == true`, {admin: true}],
  [`auth.admin == true && document.active == true`, {admin: true}],
  [`document.name == auth.name && auth.admin == false`, {name: "alice", admin: false}],
  [`document.name == auth.name || document.nick == auth.name`, {name: "alice"}],
  [`auth.role == "admin"`, {role: "admin"}],
  [`auth.role == "admin"`, {role: "member"}],
  [`true==true`, {}],
  [`false==true`, {}]
];

describe("prefilter against PostgreSQL", () => {
  let module: TestingModule;
  let bucket: any;
  let query: BucketQueryFacade;
  let documents: any[];

  const context = () => ({
    resolveSchema: () => bucket,
    preferences: () => Promise.reject(new Error("not read"))
  });

  const keysOf = async (spec: object, target = bucket) => {
    const {result} = await query.find<any>(target, spec, context());
    return new Set(result.map(document => String(document.id)));
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.postgres()],
      providers: [provideRepository(BUCKET_SCHEMA_MANAGER)]
    }).compile();
    await module.init();
    query = module.get(BUCKET_QUERY);
    bucket = await module.get<BucketSchemaManager>(BUCKET_SCHEMA_MANAGER).create(
      {
        title: "Prefilter",
        description: "",
        icon: "",
        primary: "id",
        readOnly: false,
        history: false,
        order: 0,
        acl: {read: "true==true", write: "true==true"},
        properties: {
          id: {type: "uuid", options: {generated: true}},
          name: {type: "string"},
          nick: {type: "string"},
          age: {type: "number"},
          score: {type: "number"},
          active: {type: "boolean"}
        }
      } as any,
      () => {}
    );
    const writes = module.get<BucketWriteFacade>(BUCKET_WRITE);
    for (const document of DOCUMENTS) {
      await writes.insert(
        bucket,
        {...document},
        {},
        {resolveSchema: () => bucket, deleteOne: jest.fn()}
      );
    }
    documents = (await query.find<any>(bucket, {}, context())).result;
  }, 120_000);

  afterAll(() => module.close());

  it("should have stored the documents it is checked against", () => {
    expect(documents).toHaveLength(DOCUMENTS.length);
  });

  describe("filters", () => {
    it("should never rule out a document the database returns", async () => {
      const wrong: string[] = [];
      let pruned = 0;
      let checked = 0;

      for (const filter of FILTERS) {
        let truth: Set<string>;
        try {
          truth = await keysOf({filter});
        } catch {
          continue;
        }
        const cannotMatch = prefilterOf(bucket, [filter])!;
        checked++;
        for (const document of documents) {
          if (cannotMatch(document)) {
            pruned++;
            if (truth.has(String(document.id))) {
              wrong.push(`${filter} wrongly ruled out ${JSON.stringify(document)}`);
            }
          }
        }
      }

      expect(wrong).toEqual([]);
      expect(checked).toBeGreaterThan(FILTERS.length / 2);
      expect(pruned).toBeGreaterThan(50);
    });
  });

  describe("read rules", () => {
    it("should never rule out a document the database lets the user read", async () => {
      const wrong: string[] = [];
      let pruned = 0;

      for (const [rule, user] of RULES) {
        const target = {...bucket, acl: {read: rule, write: "true==true"}};
        const truth = await keysOf({applyAcl: true, user}, target);
        const cannotMatch = prefilterOf(bucket, [rule], user)!;
        for (const document of documents) {
          if (cannotMatch(document)) {
            pruned++;
            if (truth.has(String(document.id))) {
              wrong.push(
                `${rule} for ${JSON.stringify(user)} ruled out ${JSON.stringify(document)}`
              );
            }
          }
        }
      }

      expect(wrong).toEqual([]);
      expect(pruned).toBeGreaterThan(30);
    });
  });

  describe("a filter together with a read rule", () => {
    it("should never rule out a document the database returns for both", async () => {
      const wrong: string[] = [];
      const pairs = FILTERS.flatMap(filter => RULES.slice(0, 10).map(rule => ({filter, rule})));

      for (const {
        filter,
        rule: [rule, user]
      } of pairs.filter((_pair, index) => index % 7 == 0)) {
        const target = {...bucket, acl: {read: rule, write: "true==true"}};
        let truth: Set<string>;
        try {
          truth = await keysOf({filter, applyAcl: true, user}, target);
        } catch {
          continue;
        }
        const cannotMatch = prefilterOf(bucket, [filter, rule], user)!;
        for (const document of documents) {
          if (cannotMatch(document) && truth.has(String(document.id))) {
            wrong.push(
              `${filter} + ${rule} for ${JSON.stringify(user)} ruled out ${JSON.stringify(document)}`
            );
          }
        }
      }

      expect(wrong).toEqual([]);
    });
  });
});
