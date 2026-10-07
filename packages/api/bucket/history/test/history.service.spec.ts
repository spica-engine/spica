import {TestingModule, Test} from "@nestjs/testing";
import {
  createAdHocCollection,
  DatabaseService,
  DatabaseTestingModule,
  ObjectId
} from "@spica-server/database-testing";
import {HistoryService} from "@spica-server/bucket-history";
import {diff} from "@spica-server/core-differ";

describe("History Service", () => {
  let module: TestingModule;
  let historyService: HistoryService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.standalone()],
      providers: [HistoryService]
    }).compile();
    historyService = module.get(HistoryService);

    //insert bucket and document
    await module.get(DatabaseService).collection("buckets").insertOne(bucket);

    // The table is created from the schema beforehand: because `BucketService` is bypassed, nobody creates it (R68).
    await createAdHocCollection(
      module.get(DatabaseService),
      `bucket_${bucket._id}`,
      bucket.properties as any
    );
    await module.get(DatabaseService).collection(`bucket_${bucket._id}`).insertOne(bucketDocument);

    //update bucket
    let updatedBucket = bucket;
    updatedBucket.properties.description.type = "number";
    await module
      .get(DatabaseService)
      .collection("buckets")
      .replaceOne({_id: bucket._id}, updatedBucket);

    //update document
    const updatedDocument = {...bucketDocument, description: 333};
    await module
      .get(DatabaseService)
      .collection(`bucket_${bucket._id}`)
      .replaceOne({_id: bucketDocument._id}, updatedDocument);
  });

  afterAll(() => {
    module.close();
  });

  const bucket = {
    _id: new ObjectId(),
    primary: "title",
    properties: {
      title: {
        type: "string"
      },
      description: {
        type: "string"
      }
    }
  };
  const bucketDocument = {
    _id: new ObjectId(),
    title: "test title",
    description: "test description"
  };

  describe("bucket methods", () => {
    const bucket = {
      _id: new ObjectId(),
      primary: "title",
      properties: {
        title: {
          type: "string"
        },
        description: {
          type: "string"
        }
      }
    };
    const bucketDocument = {
      _id: new ObjectId(),
      title: "test title",
      description: "test description"
    };
    beforeAll(async () => {
      await module.get(DatabaseService).collection("buckets").insertOne(bucket);

      // The table is created from the schema beforehand; because `BucketService` is bypassed, nobody creates it (R68).
      await createAdHocCollection(
        module.get(DatabaseService),
        `bucket_${bucket._id}`,
        bucket.properties as any
      );

      await module
        .get(DatabaseService)
        .collection(`bucket_${bucket._id}`)
        .insertOne(bucketDocument);
    });

    afterAll(async () => {
      await module.get(DatabaseService).collection("buckets").deleteMany({}).catch();
      await module.get(DatabaseService).collection(`bucket_${bucket._id}`).deleteMany({}).catch();
    });

    it("should get bucket document", async () => {
      const document = await historyService.getDocument(bucket._id, bucketDocument._id);
      expect(document).toEqual({
        _id: bucketDocument._id,
        title: "test title",
        description: "test description"
      });
    });
  });

  /**
   * The reads are **explicitly ordered**.
   *
   * `find({})` is unordered; MongoDB gives insertion order in practice but that is no guarantee, and on
   * PostgreSQL the heap order changes after updates. Because the tests compare ordered arrays, the order
   * has to be part of the assertion — the subject is the content, but the comparison is order sensitive.
   */
  describe("history methods", () => {
    describe("get", () => {
      const bucketId = new ObjectId();
      const documentId = new ObjectId();
      const anotherDocumentId = new ObjectId();

      const firstHistoryId = new ObjectId(
        Math.floor(new Date(2018, 11, 22).getTime() / 1000).toString(16) + "0000000000000000"
      );
      const secondHistoryId = new ObjectId(
        Math.floor(new Date(2018, 11, 24).getTime() / 1000).toString(16) + "0000000000000000"
      );
      const thirdHistoryId = new ObjectId(
        Math.floor(new Date(2018, 11, 26).getTime() / 1000).toString(16) + "0000000000000000"
      );

      const firstHistory = {
        _id: firstHistoryId,
        bucket_id: bucketId,
        document_id: documentId,
        title: "first history",
        changes: diff({title: "previous title"}, {title: "edited title"})
      };
      const secondHistory = {
        _id: secondHistoryId,
        bucket_id: bucketId,
        document_id: documentId,
        title: "second history",
        changes: diff({title: "will be deleted title"}, {description: "new added description"})
      };
      const thirdHistory = {
        _id: thirdHistoryId,
        bucket_id: bucketId,
        document_id: documentId,
        title: "third history",
        changes: diff(
          {},
          {
            title: "new added title",
            description: "new added description",
            name: "new added name"
          }
        )
      };
      const anotherHistory = {
        bucket_id: bucketId,
        document_id: anotherDocumentId,
        title: "another document history",
        changes: []
      };

      beforeAll(async () => {
        await historyService.collection.insertMany([
          firstHistory,
          secondHistory,
          thirdHistory,
          anotherHistory
        ]);
      });

      afterAll(async () => {
        await historyService.collection.deleteMany({});
      });

      it("should get history from title", async () => {
        const history = await historyService.getHistory({
          title: "third history"
        });
        expect(history).toEqual({
          _id: thirdHistoryId,
          bucket_id: bucketId,
          document_id: documentId,
          title: "third history",
          changes: diff(
            {},
            {
              title: "new added title",
              description: "new added description",
              name: "new added name"
            }
          )
        });
      });

      it("should get histories from specific history to now for specific bucket document", async () => {
        //first we need to get story which we want
        const limitHistoryId = secondHistoryId;

        //then we will get histories from specific history to now
        const histories = await historyService.findBetweenNow(bucketId, documentId, limitHistoryId);
        expect(histories).toEqual([
          {
            _id: thirdHistoryId,
            bucket_id: bucketId,
            document_id: documentId,
            title: "third history",
            changes: diff(
              {},
              {
                title: "new added title",
                description: "new added description",
                name: "new added name"
              }
            )
          },
          {
            _id: secondHistoryId,
            bucket_id: bucketId,
            document_id: documentId,
            title: "second history",
            changes: diff({title: "will be deleted title"}, {description: "new added description"})
          }
        ]);
      });

      it("should get all histories of specific bucket document", async () => {
        const histories = await historyService.find({
          document_id: documentId
        });
        expect(histories).toEqual([
          {
            _id: thirdHistoryId,
            date: new Date(2018, 11, 26),
            changes: 3
          } as any,
          {
            _id: secondHistoryId,
            date: new Date(2018, 11, 24),
            changes: 2
          } as any,
          {
            _id: firstHistoryId,
            date: new Date(2018, 11, 22),
            changes: 1
          } as any
        ]);
      });
    });

    describe("delete", () => {
      const bucketId = new ObjectId();
      const documentId = new ObjectId();
      const anotherDocumentId = new ObjectId();

      beforeEach(async () => {
        const firstHistory = {
          bucket_id: bucketId,
          document_id: documentId,
          title: "first history",
          changes: diff({title: "previous title"}, {title: "edited title"})
        };
        const secondHistory = {
          bucket_id: bucketId,
          document_id: anotherDocumentId,
          title: "second history",
          changes: diff(
            {title: null},
            {
              title: "new added title",
              description: "new added description",
              news: {title: "news title", description: "new description"}
            }
          )
        };
        const thirdHistory = {
          bucket_id: bucketId,
          document_id: documentId,
          title: "third history",
          changes: diff({description: ["first,second"]}, {description: ["new first,new second"]})
        };

        await historyService.collection.insertMany([firstHistory, secondHistory, thirdHistory]);
      });

      afterEach(async () => {
        await historyService.collection.deleteMany({});
      });

      it("should delete specific bucket document histories", async () => {
        const deletedCount = await historyService.deleteMany({
          $and: [{bucket_id: bucketId}, {document_id: documentId}]
        });
        expect(deletedCount).toBe(2);

        const histories = (await historyService.collection.find({}, {sort: {_id: 1}})).filter(
          history => delete history._id
        );
        expect(histories).toEqual([
          {
            bucket_id: bucketId,
            document_id: anotherDocumentId,
            title: "second history",
            changes: diff(
              {title: null},
              {
                title: "new added title",
                description: "new added description",
                news: {title: "news title", description: "new description"}
              }
            )
          }
        ]);
      });

      it("shouldn't delete anything", async () => {
        const deletedCount = await historyService.deleteMany({
          document_id: new ObjectId()
        });
        expect(deletedCount).toBe(0);
      });

      it("should delete all of them", async () => {
        const deletedCount = await historyService.deleteMany({});
        expect(deletedCount).toBe(3);
      });

      it("should delete histories which contain changes about only title field ,should remove title changes on histories which contain changes about title and more, shouldn't update which doesnt contain changes about title", async () => {
        const deletedCount = await historyService.deleteHistoryAtPath(bucketId, ["title"]);
        expect(deletedCount).toBe(1);

        const histories = (await historyService.collection.find({}, {sort: {_id: 1}})).map(
          history => history.changes
        );
        expect(histories).toEqual([
          diff(
            {},
            {
              description: "new added description",
              news: {title: "news title", description: "new description"}
            }
          ),
          diff({description: ["first,second"]}, {description: ["new first,new second"]})
        ]);
      });
    });

    describe("insert", () => {
      const bucketId = new ObjectId();
      const documentId = new ObjectId();

      afterEach(async () => {
        await historyService.collection.deleteMany({});
      });

      it("should delete the oldest history when the count reaches ten", async () => {
        /**
         * The insertion order is deliberately the **reverse** of the `_id` order, so "whichever row comes
         * back first" is no longer the same document as "the oldest": an unsorted `deleteOne` passes a
         * same-order fixture by luck and fails this one.
         *
         * The `_id`s come from the same generator the service uses. Left to the driver they come from its
         * own bson instance while the service's come from the application layer's — two module instances,
         * two `PROCESS_UNIQUE` values (see `packages/database/index.ts`) — and inside the same second the
         * order between the two groups is random.
         */
        const ids = Array.from(new Array(10), () => new ObjectId()).sort((a, b) =>
          a.toHexString() < b.toHexString() ? -1 : 1
        );

        for (let index = ids.length - 1; index >= 0; index--) {
          await historyService.collection.insertOne({
            _id: ids[index],
            bucket_id: bucketId,
            document_id: documentId,
            title: `${index + 1}. history`
          } as any);
        }

        const inserted = await historyService.insertOne({
          bucket_id: bucketId,
          document_id: documentId,
          title: "add me"
        });
        expect(inserted._id).toBeDefined();

        const titles = (await historyService.collection.find({}, {sort: {_id: 1}})).map(
          history => history.title
        );

        expect(titles.length).toBe(10);
        expect(titles).not.toContain("1. history");
        expect(titles).toEqual([
          "2. history",
          "3. history",
          "4. history",
          "5. history",
          "6. history",
          "7. history",
          "8. history",
          "9. history",
          "10. history",
          "add me"
        ]);
      });

      it("should add new history", async () => {
        const inserted = await historyService.createHistory(
          bucketId,
          {
            _id: documentId,
            name: "first name"
          },
          {
            _id: documentId,
            name: "updated name"
          }
        );
        expect(inserted._id).toBeDefined();

        const histories = await historyService.getHistory({
          _id: inserted._id
        });
        expect(histories).toEqual({
          _id: inserted._id,
          bucket_id: bucketId,
          document_id: documentId,
          changes: diff(
            {
              _id: documentId,
              name: "updated name"
            },
            {
              _id: documentId,
              name: "first name"
            }
          )
        });
      });

      it("should update histories", async () => {
        const inserted = await historyService.createHistory(
          bucketId,
          {
            _id: documentId,
            name: "first name",
            age: 22
          },
          {
            _id: documentId,
            name: "updated name",
            age: 33
          }
        );

        await historyService.updateHistories(
          {
            _id: bucketId,
            primary: "",
            acl: {write: "", read: ""},
            properties: {
              name: {
                type: "string",
                options: {}
              },
              age: {
                type: "number",
                options: {}
              }
            }
          },
          {
            _id: bucketId,
            primary: "",
            acl: {write: "", read: ""},
            properties: {
              name: {
                type: "string",
                options: {}
              }
            }
          }
        );

        await new Promise(resolve => setTimeout(resolve, 3000));

        const history = await historyService.getHistory({
          _id: inserted._id
        });
        expect(history).toEqual({
          _id: inserted._id,
          bucket_id: bucketId,
          document_id: documentId,
          changes: diff(
            {
              _id: documentId,
              name: "updated name"
            },
            {
              _id: documentId,
              name: "first name"
            }
          )
        });
      });
    });
  });
});
