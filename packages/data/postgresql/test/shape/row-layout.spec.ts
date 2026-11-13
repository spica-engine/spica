import {Test, TestingModule} from "@nestjs/testing";
import {fieldTableName, mainTableName, ORM} from "@spica-server/data-postgresql";
import {Orm} from "@spica-server/data-postgresql-orm";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {RESULT_SHAPER} from "@spica-server/interface-data";
import {BucketStore, bucketStoreProviders, createBucketStore} from "../contract/bucket-store.js";
import {fetchRowSet} from "./row-set-fixtures.js";
import {describeAll} from "./support.js";
import {idOf} from "@spica-server/data";

describe("PostgreSQL row layout", () => {
  const engine = {name: "postgresql", module: () => DatabaseTestingModule.postgres()} as const;
  let module: TestingModule;
  let store: BucketStore;
  let orm: Orm;
  let described: Record<string, any>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [engine.module()],
      providers: bucketStoreProviders(engine)
    }).compile();
    await module.init();
    store = createBucketStore(engine, module);
    orm = module.get(ORM);
  }, 120_000);

  afterAll(() => module.close());

  beforeEach(() => {
    store.reset();
    described = {};
  });

  async function create(properties: object) {
    const bucket = await store.createBucket(properties);
    described[String(idOf(bucket))] = bucket;
    return bucket;
  }

  const rows = async (table: string, order: string) =>
    (await orm.raw(`SELECT * FROM "${table}" ORDER BY ${order}`)).rows;

  async function shapeRows(
    bucket: any,
    key: unknown,
    change?: (rowSet: any) => void,
    locale?: any
  ) {
    const rowSet = await fetchRowSet(orm, describeAll(described), String(idOf(bucket)), key);
    change?.(rowSet);
    const shaped = await module
      .get(RESULT_SHAPER)
      .shape({kind: "bucket", bucketId: String(idOf(bucket))}, rowSet, {locale});
    return JSON.parse(JSON.stringify(shaped));
  }

  it("should store objects as prefixed columns and a location as a point, and fold them back", async () => {
    const bucket = await create({
      title: {type: "string"},
      address: {
        type: "object",
        properties: {
          city: {type: "string"},
          geo: {type: "object", properties: {lat: {type: "number"}, lng: {type: "number"}}}
        }
      },
      place: {type: "location", locationType: "Point"}
    });
    const key = await store.insert(bucket, {
      title: "a",
      address: {city: "x", geo: {lat: 1, lng: null}},
      place: {type: "Point", coordinates: [29, 41]}
    });

    expect(await rows(mainTableName(String(idOf(bucket))), "id")).toEqual([
      {
        id: key,
        title: "a",
        address__city: "x",
        address__geo__lat: 1,
        address__geo__lng: null,
        place: {x: 29, y: 41}
      }
    ]);
    expect(await shapeRows(bucket, key)).toEqual({
      id: key,
      title: "a",
      address: {city: "x", geo: {lat: 1, lng: null}},
      place: {type: "Point", coordinates: [29, 41]}
    });
  });

  it("should store array items as positioned rows and restore their order from the position", async () => {
    const bucket = await create({
      tags: {type: "array", items: {type: "string"}},
      lines: {
        type: "array",
        items: {type: "object", properties: {name: {type: "string"}}}
      }
    });
    const id = String(idOf(bucket));
    const key = await store.insert(bucket, {
      tags: ["b", "a"],
      lines: [{name: "one"}, {name: "two"}]
    });

    expect(await rows(fieldTableName(id, ["tags"]), "_position")).toEqual([
      {_parent: key, _position: 0, _value: "b"},
      {_parent: key, _position: 1, _value: "a"}
    ]);
    expect(await rows(fieldTableName(id, ["lines"]), "_position")).toEqual([
      {_parent: key, _position: 0, name: "one"},
      {_parent: key, _position: 1, name: "two"}
    ]);

    const document = await shapeRows(bucket, key, rowSet => {
      rowSet.children.tags.reverse();
      rowSet.children.lines.reverse();
    });
    expect(document).toEqual({id: key, tags: ["b", "a"], lines: [{name: "one"}, {name: "two"}]});
  });

  it("should store translations as one row per locale and links as positioned target rows", async () => {
    const target = await create({name: {type: "string"}});
    const first = await store.insert(target, {name: "first"});
    const second = await store.insert(target, {name: "second"});
    const owner = await create({
      title: {type: "string", options: {translate: true}},
      many: {type: "relation", bucketId: String(idOf(target)), relationType: "onetomany"}
    });
    const id = String(idOf(owner));
    const key = await store.insert(owner, {
      title: {en_US: "hello", tr_TR: "merhaba"},
      many: [second, first]
    });

    expect(await rows(fieldTableName(id, ["title"]), "_locale")).toEqual([
      {_parent: key, _locale: "en_US", _value: "hello"},
      {_parent: key, _locale: "tr_TR", _value: "merhaba"}
    ]);
    expect(await rows(fieldTableName(id, ["many"]), "_position")).toEqual([
      {_parent: key, _position: 0, _target: second},
      {_parent: key, _position: 1, _target: first}
    ]);

    expect(await shapeRows(owner, key)).toEqual({
      id: key,
      title: {en_US: "hello", tr_TR: "merhaba"},
      many: [second, first]
    });
    expect(
      await shapeRows(owner, key, undefined, {best: "tr_TR", fallback: "en_US"})
    ).toMatchObject({title: "merhaba"});
  });
});
