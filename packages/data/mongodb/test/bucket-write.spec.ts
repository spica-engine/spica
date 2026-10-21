import {Test} from "@nestjs/testing";
import {PassthroughResultShaper} from "@spica-server/data";
import {MongoBucketWriteFacade} from "@spica-server/data-mongodb";
import {DatabaseService, DatabaseTestingModule, ObjectId} from "@spica-server/database-testing";
import {Bucket, LimitExceedBehaviours} from "@spica-server/interface-bucket";

describe("MongoBucketWriteFacade", () => {
  let db: DatabaseService;
  let facade: MongoBucketWriteFacade;
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
    facade = new MongoBucketWriteFacade(db, new PassthroughResultShaper());
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
      const limited = new MongoBucketWriteFacade(db, new PassthroughResultShaper(), 1);
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

  it("should pass results through the result shaper as bucket resources", async () => {
    const shaper = {shape: jest.fn((_, result) => result)};
    const shaped = new MongoBucketWriteFacade(db, shaper);

    await shaped.insert(bucket, {title: "a"}, {}, context());

    expect(shaper.shape).toHaveBeenCalledWith(
      {kind: "bucket", bucketId: bucket._id.toString()},
      expect.objectContaining({title: "a"})
    );
  });
});
