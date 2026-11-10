import {Test} from "@nestjs/testing";
import {PassthroughResultShaper} from "@spica-server/data";
import {
  MongoBucketQueryFacade,
  MongoBucketWriteFacade,
  MongoIdTypes
} from "@spica-server/data-mongodb";
import {DatabaseService, DatabaseTestingModule, ObjectId} from "@spica-server/database-testing";
import {Bucket, LimitExceedBehaviours} from "@spica-server/interface-bucket";

describe("MongoBucketWriteFacade", () => {
  let db: DatabaseService;
  let facade: MongoBucketWriteFacade;
  let query: MongoBucketQueryFacade;
  let bucket: Bucket;

  const context = (overrides: object = {}) => ({
    resolveSchema: () => bucket,
    deleteOne: jest.fn(async (_id: any) => {}),
    ...overrides
  });

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet()]
    }).compile();
    db = module.get(DatabaseService);
    query = new MongoBucketQueryFacade(db, new PassthroughResultShaper(), new MongoIdTypes());
    facade = new MongoBucketWriteFacade(db, new PassthroughResultShaper(), query);
    bucket = {
      _id: new ObjectId(),
      title: "Books",
      primary: "title",
      acl: {read: "true==true", write: "true==true"},
      properties: {title: {type: "string"}, owner: {type: "string"}}
    } as any;
    await db.collection("buckets").insertOne(bucket as any);
  });

  const documents = () => db.collection(`bucket_${bucket._id}`).find().toArray();

  describe("insert", () => {
    it("should insert into the bucket's collection and return the document with its id", async () => {
      const inserted = await facade.insert(bucket, {title: "a"}, {}, context());

      expect(inserted).toEqual({_id: expect.any(ObjectId), title: "a"});
      expect(await documents()).toEqual([inserted]);
    });

    it("should report a unique index violation as a bad request", async () => {
      await db.collection(`bucket_${bucket._id}`).createIndex({title: 1}, {unique: true});
      await facade.insert(bucket, {title: "a"}, {}, context());

      await expect(facade.insert(bucket, {title: "a"}, {}, context())).rejects.toMatchObject({
        status: 400,
        message: "Value of the property .title should unique across all documents."
      });
    });

    it("should reject inserts beyond the bucket's count limit", async () => {
      bucket.documentSettings = {countLimit: 1} as any;
      await facade.insert(bucket, {title: "a"}, {}, context());

      await expect(facade.insert(bucket, {title: "b"}, {}, context())).rejects.toThrow(
        "Maximum number of documents has been reached"
      );
    });

    it("should hand the oldest documents to deleteOne when the bucket removes on overflow", async () => {
      bucket.documentSettings = {
        countLimit: 2,
        limitExceedBehaviour: LimitExceedBehaviours.REMOVE
      } as any;
      const first = await db.collection(`bucket_${bucket._id}`).insertOne({title: "first"});
      await db.collection(`bucket_${bucket._id}`).insertOne({title: "second"});
      const ctx = context({
        deleteOne: jest.fn(async (id: any) => {
          await db.collection(`bucket_${bucket._id}`).deleteOne({_id: id});
        })
      });

      await facade.insert(bucket, {title: "third"}, {}, ctx);

      expect(ctx.deleteOne).toHaveBeenCalledTimes(1);
      expect(ctx.deleteOne.mock.calls[0][0]).toEqual(first.insertedId);
      expect((await documents()).map(d => d.title)).toEqual(["second", "third"]);
    });

    it("should enforce the total bucket data limit", async () => {
      const limited = new MongoBucketWriteFacade(db, new PassthroughResultShaper(), query, 1);
      await limited.insert(bucket, {title: "a"}, {}, context());

      await expect(limited.insert(bucket, {title: "b"}, {}, context())).rejects.toThrow(
        "Total bucket-data limit exceeded"
      );
    });

    it("should reject a write the bucket's write rule denies", async () => {
      bucket.acl.write = "document.owner == auth._id";

      await expect(
        facade.insert(
          bucket,
          {title: "a", owner: "x"},
          {applyAcl: true, user: {_id: "y"}},
          context()
        )
      ).rejects.toMatchObject({status: 401, message: "ACL rules has rejected this operation."});
      expect(await documents()).toEqual([]);

      await facade.insert(
        bucket,
        {title: "a", owner: "y"},
        {applyAcl: true, user: {_id: "y"}},
        context()
      );
      expect(await documents()).toHaveLength(1);
    });

    it("should report a broken write rule as an ACL syntax error", async () => {
      bucket.acl.write = "document.owner ==";

      await expect(
        facade.insert(bucket, {title: "a"}, {applyAcl: true, user: {}}, context())
      ).rejects.toMatchObject({status: 400, message: expect.stringContaining("ACL rule syntax")});
    });
  });

  describe("replace and patch", () => {
    let _id: ObjectId;

    beforeEach(async () => {
      _id = (await db.collection(`bucket_${bucket._id}`).insertOne({title: "a", owner: "x"}))
        .insertedId;
    });

    it("should return the document before the replacement by default", async () => {
      const previous = await facade.replace(bucket, {_id, title: "b"}, {}, context());

      expect(previous).toEqual({_id, title: "a", owner: "x"});
      expect(await documents()).toEqual([{_id, title: "b"}]);
    });

    it("should return the replaced document when asked for the document after", async () => {
      const current = await facade.replace(
        bucket,
        {_id, title: "b"},
        {returnDocument: "after"},
        context()
      );

      expect(current).toEqual({_id, title: "b"});
    });

    it("should return null when there is nothing to replace", async () => {
      expect(
        await facade.replace(bucket, {_id: new ObjectId(), title: "b"}, {}, context())
      ).toBeNull();
    });

    it("should apply a merge patch and return the patched document", async () => {
      const current = await facade.patch(
        bucket,
        {_id, title: "b"},
        {title: "b", owner: null},
        {returnDocument: "after"},
        context()
      );

      expect(current).toEqual({_id, title: "b"});
      expect(await documents()).toEqual([{_id, title: "b"}]);
    });
  });

  describe("delete", () => {
    it("should delete the document and return it", async () => {
      const {insertedId} = await db.collection(`bucket_${bucket._id}`).insertOne({title: "a"});

      const deleted = await facade.delete(bucket, insertedId.toHexString(), {}, context());

      expect(deleted).toEqual({_id: insertedId, title: "a"});
      expect(await documents()).toEqual([]);
    });

    it("should delete nothing for a missing or null id", async () => {
      await db.collection(`bucket_${bucket._id}`).insertOne({title: "a"});

      expect(await facade.delete(bucket, new ObjectId(), {}, context())).toBeUndefined();
      expect(await facade.delete(bucket, null, {}, context())).toBeUndefined();
      expect(await documents()).toHaveLength(1);
    });
  });

  describe("write rules over relations", () => {
    let boss: Bucket;
    let author: Bucket;
    let ann: ObjectId;
    let bob: ObjectId;
    let ceo: ObjectId;

    const buckets = () => [bucket, author, boss];

    const withRule = (rule: string) => {
      bucket.acl.write = rule;
      bucket.properties = {
        title: {type: "string"},
        author: {type: "relation", bucketId: author._id.toString(), relationType: "onetoone"},
        editors: {type: "relation", bucketId: author._id.toString(), relationType: "onetomany"},
        meta: {
          type: "object",
          properties: {
            author: {type: "relation", bucketId: author._id.toString(), relationType: "onetoone"}
          }
        }
      } as any;
    };

    const copyOf = (b: Bucket) => ({...b, properties: JSON.parse(JSON.stringify(b.properties))});

    const ruleContext = () => ({
      ...context(),
      resolveSchema: (id: any) => copyOf(buckets().find(b => b._id.toString() == id.toString())!)
    });

    const options = {applyAcl: true, user: {_id: "u"}};

    beforeEach(async () => {
      boss = {
        _id: new ObjectId(),
        title: "Bosses",
        primary: "title",
        acl: {read: "true==true", write: "true==true"},
        properties: {title: {type: "string"}}
      } as any;
      author = {
        _id: new ObjectId(),
        title: "Authors",
        primary: "name",
        acl: {read: "true==true", write: "true==true"},
        properties: {
          name: {type: "string"},
          boss: {type: "relation", bucketId: boss._id.toString(), relationType: "onetoone"}
        }
      } as any;
      await db.collection("buckets").insertMany([boss as any, author as any]);

      ceo = (await db.collection(`bucket_${boss._id}`).insertOne({title: "ceo"})).insertedId;
      ann = (
        await db
          .collection(`bucket_${author._id}`)
          .insertOne({name: "ann", boss: ceo.toHexString()})
      ).insertedId;
      bob = (await db.collection(`bucket_${author._id}`).insertOne({name: "bob"})).insertedId;
    });

    const insert = (document: object) => facade.insert(bucket, document, options, ruleContext());

    const allowed = () => expect(documents()).resolves.toHaveLength(1);
    const denied = {status: 401, message: "ACL rules has rejected this operation."};

    it("should evaluate a rule on the related document of a one-to-one relation", async () => {
      withRule("document.author.name == 'ann'");

      await expect(insert({title: "a", author: bob.toHexString()})).rejects.toMatchObject(denied);
      expect(await documents()).toEqual([]);

      await insert({title: "a", author: ann.toHexString()});
      await allowed();
    });

    it("should evaluate a rule through two relations", async () => {
      withRule("document.author.boss.title == 'ceo'");

      await expect(insert({title: "a", author: bob.toHexString()})).rejects.toMatchObject(denied);

      await insert({title: "a", author: ann.toHexString()});
      await allowed();
    });

    it("should evaluate a rule on a relation inside an object", async () => {
      withRule("document.meta.author.name == 'ann'");

      await expect(insert({title: "a", meta: {author: bob.toHexString()}})).rejects.toMatchObject(
        denied
      );

      await insert({title: "a", meta: {author: ann.toHexString()}});
      await allowed();
    });

    it("should treat a relation to a missing document as absent", async () => {
      withRule("has(document.author.name)");

      await expect(
        insert({title: "a", author: new ObjectId().toHexString()})
      ).rejects.toMatchObject(denied);
      await expect(insert({title: "a"})).rejects.toMatchObject(denied);

      await insert({title: "a", author: ann.toHexString()});
      await allowed();
    });

    it("should evaluate a rule on the related documents of a one-to-many relation", async () => {
      withRule("length(document.editors) == 2 || document.editors.name == 'none'");
      const missing = new ObjectId().toHexString();

      await expect(
        insert({title: "a", editors: [ann.toHexString(), missing]})
      ).rejects.toMatchObject(denied);

      await insert({title: "a", editors: [bob.toHexString(), ann.toHexString()]});
      await allowed();
    });

    it("should leave the given document as it was", async () => {
      withRule("document.author.name == 'ann'");
      const document = {title: "a", author: ann.toHexString()};

      await insert(document);

      expect(document.author).toBe(ann.toHexString());
      expect(await documents()).toEqual([expect.objectContaining({author: ann.toHexString()})]);
    });

    it("should evaluate a rule on the replacement, not on the stored document", async () => {
      withRule("true==true");
      const {_id} = await insert({title: "a", author: bob.toHexString()});
      withRule("document.author.name == 'ann'");

      await expect(
        facade.replace(bucket, {_id, title: "b", author: bob.toHexString()}, options, ruleContext())
      ).rejects.toMatchObject(denied);

      await facade.replace(
        bucket,
        {_id, title: "b", author: ann.toHexString()},
        options,
        ruleContext()
      );
      expect(await documents()).toEqual([{_id, title: "b", author: ann.toHexString()}]);
    });

    it("should evaluate a rule on the patched document", async () => {
      withRule("true==true");
      const {_id} = await insert({title: "a", author: bob.toHexString()});
      withRule("document.author.name == 'ann'");

      await expect(
        facade.patch(
          bucket,
          {_id, title: "b", author: bob.toHexString()},
          {title: "b"},
          options,
          ruleContext()
        )
      ).rejects.toMatchObject(denied);

      await facade.patch(
        bucket,
        {_id, title: "a", author: ann.toHexString()},
        {author: ann.toHexString()},
        options,
        ruleContext()
      );
      expect(await documents()).toEqual([{_id, title: "a", author: ann.toHexString()}]);
    });

    it("should evaluate a rule on the stored document when deleting", async () => {
      withRule("true==true");
      const {_id} = await insert({title: "a", author: bob.toHexString()});
      withRule("document.author.name == 'ann'");

      await expect(
        facade.delete(bucket, _id.toHexString(), options, ruleContext())
      ).rejects.toMatchObject(denied);
      expect(await documents()).toHaveLength(1);

      withRule("document.author.name == 'bob'");
      await facade.delete(bucket, _id.toHexString(), options, ruleContext());
      expect(await documents()).toEqual([]);
    });
  });

  it("should pass results through the result shaper as bucket resources", async () => {
    const shaper = {shape: jest.fn((_, result) => result)};
    const shaped = new MongoBucketWriteFacade(db, shaper, query);

    await shaped.insert(bucket, {title: "a"}, {}, context());

    expect(shaper.shape).toHaveBeenCalledWith(
      {kind: "bucket", bucketId: bucket._id.toString()},
      expect.objectContaining({title: "a"})
    );
  });
});
