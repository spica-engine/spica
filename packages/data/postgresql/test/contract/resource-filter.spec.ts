import {Test, TestingModule} from "@nestjs/testing";
import {InvalidIdError} from "@spica-server/data";
import {createTables, defineEntity, Session} from "@spica-server/data-postgresql-orm";
import {renderResourceFilter} from "@spica-server/database-pipeline";
import {contractSuite, DatabaseService} from "@spica-server/database-testing";
import {ID_TYPES, IdType, IdTypes, PG_POOL, ResourceFilterSpec} from "@spica-server/interface-data";
import pg from "pg";
import {keyParser, resourceFilterCondition} from "../../src/access/resource-filter";

const COLLECTION = "resource_filter_cases";
const entity = defineEntity<{id: string}>({table: COLLECTION, columns: {}});

contractSuite("resource filter", engine => {
  let module: TestingModule;
  let idType: IdType;
  let ids: string[];

  beforeAll(async () => {
    module = await Test.createTestingModule({imports: [engine.module()]}).compile();
    await module.init();
    idType = module.get<IdTypes>(ID_TYPES).forCollection(COLLECTION);
    if (engine.name == "postgresql") {
      await createTables(module.get<pg.Pool>(PG_POOL), [entity]);
    }
  });

  afterAll(() => module.close());

  beforeEach(async () => {
    ids = [0, 1, 2, 3].map(() => idType.serialize(idType.generate()));
    if (engine.name == "mongodb") {
      const collection = module.get(DatabaseService).collection(COLLECTION);
      await collection.deleteMany({});
      await collection.insertMany(ids.map(id => ({_id: idType.parse(id)})));
    } else {
      const pool = module.get<pg.Pool>(PG_POOL);
      await pool.query(`TRUNCATE ${COLLECTION}`);
      const session = new Session(pool);
      for (const id of ids) {
        await session.insert(entity, {id});
      }
    }
  });

  async function select(filter: ResourceFilterSpec | undefined): Promise<string[]> {
    if (engine.name == "mongodb") {
      const stage = renderResourceFilter(filter, id => idType.parse(id));
      const rows = await module
        .get(DatabaseService)
        .collection(COLLECTION)
        .find(stage?.$match ?? {})
        .toArray();
      return rows.map(row => idType.serialize(row._id as never));
    }
    const rows = await new Session(module.get<pg.Pool>(PG_POOL)).findMany(entity, {
      id: resourceFilterCondition(filter, keyParser("uuid"))
    });
    return rows.map(row => row.id);
  }

  function allowed(filter: ResourceFilterSpec, id: string) {
    const alternatives = [...filter.exclude.map(list => !list.includes(id))];
    if (filter.include.length) {
      alternatives.push(filter.include.includes(id));
    }
    return alternatives.length ? alternatives.some(Boolean) : true;
  }

  const cases: [string, (ids: string[]) => ResourceFilterSpec | undefined][] = [
    ["no filter", () => undefined],
    ["empty include and exclude", () => ({include: [], exclude: []})],
    ["include only", ([a, b]) => ({include: [a, b], exclude: []})],
    [
      "include of an id that does not exist",
      () => ({include: [idType.serialize(idType.generate())], exclude: []})
    ],
    ["one exclude list", ([a]) => ({include: [], exclude: [[a]]})],
    ["two exclude lists are alternatives", ([a, b]) => ({include: [], exclude: [[a], [b]]})],
    ["an exclude list that names everything", ids => ({include: [], exclude: [ids]})],
    ["an empty exclude list", () => ({include: [], exclude: [[]]})],
    ["include next to exclude", ([a, b, c]) => ({include: [c], exclude: [[a, b]]})],
    ["duplicate ids", ([a, b]) => ({include: [a, a], exclude: [[b, b]]})]
  ];

  it.each(cases)("should select the rows the filter allows: %s", async (_, build) => {
    const filter = build(ids);
    const expected = ids.filter(id => allowed(filter ?? {include: [], exclude: []}, id));

    expect((await select(filter)).sort()).toEqual(expected.sort());
  });

  it("should select nothing but the included row for a single include", async () => {
    expect(await select({include: [ids[2]], exclude: []})).toEqual([ids[2]]);
  });

  it("should reject an id that is not valid for the engine", async () => {
    const filter = {include: ["not-an-id"], exclude: []};
    const render = () =>
      engine.name == "mongodb"
        ? renderResourceFilter(filter, id => idType.parse(id))
        : resourceFilterCondition(filter, keyParser("uuid"));

    expect(render).toThrow(InvalidIdError);
  });
});
