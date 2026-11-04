import {Test} from "@nestjs/testing";
import {
  getUpdateParams,
  MongoBucketDataRepository,
  MongoBucketRepository
} from "@spica-server/data-mongodb";
import {DatabaseService, DatabaseTestingModule, ObjectId} from "@spica-server/database-testing";
import {RelationType} from "@spica-server/interface-bucket-common";

describe("bucket repositories", () => {
  let db: DatabaseService;
  let buckets: MongoBucketRepository;
  let bucketData: MongoBucketDataRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet()]
    }).compile();
    db = module.get(DatabaseService);
    buckets = new MongoBucketRepository(db);
    bucketData = new MongoBucketDataRepository(db);
  });

  const bucket = (properties: object, extra: object = {}) =>
    ({
      title: "b",
      primary: "title",
      acl: {read: "true==true", write: "true==true"},
      properties,
      ...extra
    }) as any;

  it("should get update operation params for one to one relation", () => {
    const updateParams = getUpdateParams("test_key", RelationType.One, "document_id");
    expect(updateParams).toEqual({
      filter: {test_key: "document_id"},
      update: {$unset: {test_key: ""}}
    });
  });

  it("should get update operation params for one to many relation", () => {
    const updateParams = getUpdateParams("test_key", RelationType.Many, "document_id");
    expect(updateParams).toEqual({
      filter: {test_key: {$in: ["document_id"]}},
      update: {$pull: {test_key: "document_id"}}
    });
  });

  it("should list the ids of buckets that relate to the bucket", async () => {
    const target = await buckets.insert(bucket({title: {type: "string"}}));
    const referencing = await buckets.insert(
      bucket({owner: {type: "relation", bucketId: target._id.toString()}})
    );
    await buckets.insert(bucket({owner: {type: "relation", bucketId: "other"}}));

    expect(await buckets.findReferencing(target._id.toString())).toEqual([
      referencing._id.toString()
    ]);
  });

  it("should read only the translatable properties of translatable buckets", async () => {
    const translatable = await buckets.insert(
      bucket({
        title: {type: "string", options: {translate: true}},
        count: {type: "number"}
      })
    );
    await buckets.insert(bucket({count: {type: "number"}}));

    expect(await buckets.findTranslatable()).toEqual([
      {_id: translatable._id, properties: {title: {type: "string", options: {translate: true}}}}
    ]);
  });

  it("should sum the count limits of every bucket", async () => {
    expect(await buckets.sumOfCountLimits()).toEqual(0);

    await buckets.insert(bucket({}, {documentSettings: {countLimit: 3}}));
    await buckets.insert(bucket({}, {documentSettings: {countLimit: 4}}));
    await buckets.insert(bucket({}));

    expect(await buckets.sumOfCountLimits()).toEqual(7);
  });

  it("should unset properties of a bucket schema by dotted path", async () => {
    const {_id} = await buckets.insert(
      bucket({title: {type: "string"}, meta: {type: "object", properties: {a: {}, b: {}}}})
    );

    await buckets.unsetProperties(_id, ["properties.title", "properties.meta.properties.a"]);

    expect((await buckets.findById(_id)).properties).toEqual({
      meta: {type: "object", properties: {b: {}}}
    });
  });

  it("should replace a bucket and return it as replaced", async () => {
    const {_id} = await buckets.insert(bucket({title: {type: "string"}}));

    const replaced = await buckets.replaceById(_id, bucket({}, {title: "renamed"}));

    expect(replaced).toEqual(expect.objectContaining({_id, title: "renamed", properties: {}}));
    expect(await buckets.replaceById(new ObjectId(), bucket({}))).toBeNull();
  });

  describe("bucket data", () => {
    let schema: any;

    beforeEach(async () => {
      schema = await buckets.insert(bucket({title: {type: "string"}}));
      await bucketData.createStorage(schema);
    });

    const documents = () => db.collection(`bucket_${schema._id}`).find().toArray();

    it("should unset fields of every document, including fields inside arrays", async () => {
      await db.collection(`bucket_${schema._id}`).insertOne({
        title: "a",
        keep: 1,
        items: [
          {name: "x", value: 1},
          {name: "y", value: 2}
        ]
      });

      await bucketData.unsetFields(schema, [["title"], ["items", /[0-9]*/ as any, "value"]]);

      expect(await documents()).toEqual([
        {_id: expect.any(ObjectId), keep: 1, items: [{name: "x"}, {name: "y"}]}
      ]);
    });

    it("should clear one to one and one to many relations to a document", async () => {
      await db.collection(`bucket_${schema._id}`).insertMany([
        {one: "d1", many: ["d1", "d2"]},
        {one: "d2", many: ["d2"]}
      ]);

      await bucketData.clearRelation(schema, "one", RelationType.One, "d1");
      await bucketData.clearRelation(schema, "many", RelationType.Many, "d2");

      expect((await documents()).map(({_id, ...rest}) => rest)).toEqual([
        {many: ["d1"]},
        {one: "d2", many: []}
      ]);
    });

    it("should drop the bucket's storage", async () => {
      await bucketData.dropStorage(schema._id);

      expect(
        (await db.listCollections().toArray()).map(c => c.name).includes(`bucket_${schema._id}`)
      ).toEqual(false);
    });
  });
});
