import {TestingModule, Test} from "@nestjs/testing";
import {
  DatabaseTestingModule,
  DatabaseService,
  ObjectId,
  DeleteWriteOpResultObject,
  InsertOneWriteOpResult
} from "@spica-server/database/testing";
import {HistoryService} from "./history.service";
import {diff} from "./differ";

describe("History Service", () => {
  let module: TestingModule;
  let historyService: HistoryService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet()],
      providers: [HistoryService]
    }).compile();
    historyService = module.get(HistoryService);
  }, 30000);

  afterAll(async () => {
    await module.close();
  });

  describe("previous methods", () => {
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
      //insert bucket and document
      await module
        .get(DatabaseService)
        .collection("buckets")
        .insertOne(bucket);
      await module
        .get(DatabaseService)
        .collection(`bucket_${bucket._id}`)
        .insertOne(bucketDocument);

      //delay settings for replicaset
      await DatabaseTestingModule.setDelayedReplica(await module.get(DatabaseService));

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
    }, 30000);

    afterAll(async () => {
      await module
        .get(DatabaseService)
        .collection("buckets")
        .deleteMany({})
        .catch();
      await module
        .get(DatabaseService)
        .collection(`bucket_${bucket._id}`)
        .deleteMany({})
        .catch();
    });

    it("should get previous bucket schema", async () => {
      //be sure schema is updated
      const currentSchema = await historyService.getSchema(bucket._id);
      expect(currentSchema).toEqual({
        _id: bucket._id,
        primary: "title",
        properties: {
          title: {
            type: "string"
          },
          description: {
            type: "number"
          }
        }
      });

      //now we can check previous schema
      const previousSchema = await historyService.getPreviousSchema(bucket._id);
      expect(previousSchema).toEqual({
        _id: bucket._id,
        primary: "title",
        properties: {
          title: {
            type: "string"
          },
          description: {
            type: "string"
          }
        }
      });
    });

    it("should get previous document", async () => {
      //be sure document is updated
      const currentDocument = await historyService.getDocument(bucket._id, bucketDocument._id);
      expect(currentDocument).toEqual({
        _id: bucketDocument._id,
        title: "test title",
        description: 333
      });

      //now we can check previous document
      const previousDocument = await historyService.getPreviousDocument(
        bucket._id,
        bucketDocument._id
      );
      expect(previousDocument).toEqual({
        _id: bucketDocument._id,
        title: "test title",
        description: "test description"
      });
    });
  });

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
      await module
        .get(DatabaseService)
        .collection("buckets")
        .insertOne(bucket);

      await module
        .get(DatabaseService)
        .collection(`bucket_${bucket._id}`)
        .insertOne(bucketDocument);
    });

    afterAll(async () => {
      await module
        .get(DatabaseService)
        .collection("buckets")
        .deleteMany({})
        .catch();
      await module
        .get(DatabaseService)
        .collection(`bucket_${bucket._id}`)
        .deleteMany({})
        .catch();
    });

    it("should get bucket schema", async () => {
      const schema = await historyService.getSchema(bucket._id);
      expect(schema).toEqual({
        _id: bucket._id,
        primary: "title",
        properties: {
          title: {
            type: "string"
          },
          description: {
            type: "string"
          }
        }
      });
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
          {title: "new added title", description: "new added description", name: "new added name"}
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
        const history = await historyService.getHistory({title: "third history"});
        expect(history).toEqual({
          _id: thirdHistoryId,
          bucket_id: bucketId,
          document_id: documentId,
          title: "third history",
          changes: diff(
            {},
            {title: "new added title", description: "new added description", name: "new added name"}
          )
        });
      });

      it("should get histories from spesific history to now for spesific bucket document", async () => {
        //first we need to get story which we want
        const limitHistoryId = secondHistoryId;

        //then we will get histories from spesific history to now
        const histories = await historyService.findBetweenNow(
          bucketId,
          documentId,
          limitHistoryId
        );
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

      it("should get all histories of spesific bucket document", async () => {
        const histories = await historyService.find({document_id: documentId});
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

        await historyService.collection.insertMany([
          firstHistory,
          secondHistory,
          thirdHistory
        ]);
      });

      afterEach(async () => {
        await historyService.collection.deleteMany({});
      });

      it("should delete spesific bucket document histories", async () => {
        const response: DeleteWriteOpResultObject = await historyService.deleteMany({
          $and: [{bucket_id: bucketId}, {document_id: documentId}]
        });
        expect(response.deletedCount).toBe(2);

        const histories = (await historyService.collection.find({}).toArray()).filter(
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
        const response: DeleteWriteOpResultObject = await historyService.deleteMany({
          document_id: new ObjectId()
        });
        expect(response.deletedCount).toBe(0);
      });

      it("should delete all of them", async () => {
        const response: DeleteWriteOpResultObject = await historyService.deleteMany({});
        expect(response.deletedCount).toBe(3);
      });

      it("should delete histories which contain changes about only title field ,should remove title changes on histories which contain changes about title and more, shouldn't update which doesnt contain changes about title", async () => {
        const response = await historyService.deleteHistoryAtPath(bucketId, ["title"]);
        expect(response.deletedCount).toBe(1);

        const histories = (await historyService.collection.find({}).toArray()).map(
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

      it("should delete first history before add new history if history count is ten or more", async () => {
        //fill the collection
        const histories = Array.from(new Array(10), (val, index) => ({
          bucket_id: bucketId,
          document_id: documentId,
          //index starts with 0
          title: `${index + 1}. history`
        }));
        await historyService.collection.insertMany(histories);

        //add history
        const response: InsertOneWriteOpResult = await historyService.insertOne({
          bucket_id: bucketId,
          document_id: documentId,
          title: "add me"
        });
        expect(response.insertedCount).toBe(1);

        const historyTitles = (await historyService.collection.find({}).toArray()).map(
          history => history.title
        );
        expect(historyTitles.length).toBe(10);
        expect(historyTitles).toEqual([
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

      it("should add new history without delete any", async () => {
        await historyService.collection.insertOne({
          bucket_id: bucketId,
          document_id: documentId,
          title: "first title"
        });

        const response: InsertOneWriteOpResult = await historyService.insertOne({
          bucket_id: bucketId,
          document_id: documentId,
          title: "new title"
        });
        expect(response.insertedCount).toBe(1);

        const histories = await historyService.collection.find({}).toArray();
        expect(histories.filter(history => delete history._id)).toEqual([
          {
            bucket_id: bucketId,
            document_id: documentId,
            title: "first title"
          },
          {
            bucket_id: bucketId,
            document_id: documentId,
            title: "new title"
          }
        ]);
      });
    });
  });
});
