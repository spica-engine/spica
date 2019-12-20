import {BucketWatcher} from "./watcher";
import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseTestingModule, DatabaseService, ObjectId} from "@spica-server/database/testing";
import {HistoryModule} from "./history.module";

describe("Watcher", () => {
  let module: TestingModule;

  const firstBucket = {
    _id: new ObjectId(),
    title: "New Bucket",
    description: "Describe your new bucket",
    icon: "view_stream",
    primary: "title",
    readOnly: false,
    properties: {
      title: {
        type: "string",
        title: "title",
        description: "Title of the row",
        options: {position: "left", visible: true}
      },
      description: {
        type: "textarea",
        title: "description",
        description: "Description of the row",
        options: {position: "right"}
      }
    }
  };

  const firstBucketDocuments = [
    {
      _id: new ObjectId(),
      title: "first bucket first title",
      description: "first bucket first description"
    },
    {
      _id: new ObjectId(),
      title: "first bucket second title",
      description: "first bucket second description"
    }
  ];

  const firstBucketDocumentsHistories = [
    {
      bucket_id: firstBucket._id,
      document_id: firstBucketDocuments[0]._id,
      title: "first bucket first document first history"
    },
    {
      bucket_id: firstBucket._id,
      document_id: firstBucketDocuments[0]._id,
      title: "first bucket first document second history"
    },
    {
      bucket_id: firstBucket._id,
      document_id: firstBucketDocuments[1]._id,
      title: "first bucket second document first history"
    },
    {
      bucket_id: firstBucket._id,
      document_id: firstBucketDocuments[1]._id,
      title: "first bucket second document second history"
    }
  ];

  const secondBucket = {
    _id: new ObjectId(),
    title: "New Bucket",
    description: "Describe your new bucket",
    icon: "view_stream",
    primary: "title",
    readOnly: false,
    properties: {
      title: {
        type: "string",
        title: "title",
        description: "Title of the row",
        options: {position: "left", visible: true}
      },
      description: {
        type: "textarea",
        title: "description",
        description: "Description of the row",
        options: {position: "right"}
      }
    }
  };

  const secondBucketDocuments = [
    {
      _id: new ObjectId(),
      title: "second bucket first title",
      description: "second bucket first description"
    },
    {
      _id: new ObjectId(),
      title: "second bucket second title",
      description: "second bucket second description"
    }
  ];

  const secondBucketDocumentsHistories = [
    {
      bucket_id: secondBucket._id,
      document_id: secondBucketDocuments[0]._id,
      title: "second bucket first document first history"
    },
    {
      bucket_id: secondBucket._id,
      document_id: secondBucketDocuments[0]._id,
      title: "second bucket first document second history"
    },
    {
      bucket_id: secondBucket._id,
      document_id: secondBucketDocuments[1]._id,
      title: "second bucket second document first history"
    },
    {
      bucket_id: secondBucket._id,
      document_id: secondBucketDocuments[1]._id,
      title: "second bucket second document second history"
    }
  ];

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet(), HistoryModule]
    }).compile();
    // add buckets
    await module
      .get(DatabaseService)
      .collection("buckets")
      .insertMany([firstBucket, secondBucket]);

    //add documents
    await module
      .get(DatabaseService)
      .collection(`bucket_${firstBucket._id}`)
      .insertMany(firstBucketDocuments);
    await module
      .get(DatabaseService)
      .collection(`bucket_${secondBucket._id}`)
      .insertMany(secondBucketDocuments);

    //add histories
    await module
      .get(DatabaseService)
      .collection("history")
      .insertMany(firstBucketDocumentsHistories);
    await module
      .get(DatabaseService)
      .collection("history")
      .insertMany(secondBucketDocumentsHistories);
  }, 30000);

  afterAll(async () => {
    await module.close();
  });

  //add tests after replica set story done
  describe("bucket changes", () => {
    it("should delete first bucket histories on history collection when first bucket deleted", done => {
      setTimeout(async () => {
        await module
          .get(DatabaseService)
          .collection("buckets")
          .deleteOne({_id: firstBucket._id})
          .then(() => {
            setTimeout(async () => {
              expect(
                (await module
                  .get(DatabaseService)
                  .collection("history")
                  .find({})
                  .toArray()).map(history => history.title)
              ).toEqual([
                "second bucket first document first history",
                "second bucket first document second history",
                "second bucket second document first history",
                "second bucket second document second history"
              ]);
              done();
            }, 100);
          });
      }, 100);
    });
  });

  //add tests after replica set story done
  describe("bucket document changes", () => {
    it("should delete first bucket first document histories on history collection when first bucket first document deleted", done => {
      setTimeout(async () => {
        await module
          .get(DatabaseService)
          .collection(`bucket_${firstBucket._id}`)
          .deleteOne({_id: firstBucketDocuments[0]._id})
          .then(() => {
            setTimeout(async () => {
              expect(
                (await module
                  .get(DatabaseService)
                  .collection("history")
                  .find({})
                  .toArray()).map(history => history.title)
              ).toEqual([
                "first bucket second document first history",
                "first bucket second document second history",
                "second bucket first document first history",
                "second bucket first document second history",
                "second bucket second document first history",
                "second bucket second document second history"
              ]);
              done();
            }, 100);
          });
      }, 100);
    });
  });
});
