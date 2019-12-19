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
  }, 12000);

  afterAll(async () => {
    await module.close();
  });

  //add get previous schema and document after created test environment for replica sets of database testing module
  describe("bucket methods", () => {
    let myBucketId = new ObjectId();
    let myDocumentId = new ObjectId();
    beforeAll(async () => {
      await module
        .get(DatabaseService)
        .collection("buckets")
        .insertOne({
          _id: myBucketId,
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

      await module
        .get(DatabaseService)
        .collection(`bucket_${myBucketId}`)
        .insertOne({_id: myDocumentId, title: "test title", description: "test description"});
    });

    afterAll(async () => {
      await module
        .get(DatabaseService)
        .collection("buckets")
        .deleteMany({})
        .catch();
      await module
        .get(DatabaseService)
        .collection(`bucket_${myBucketId}`)
        .deleteMany({})
        .catch();
    });

    it("should get bucket schema", async () => {
      const mybucketSchema = await historyService.getSchema(myBucketId);
      expect(mybucketSchema).toEqual({
        _id: myBucketId,
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
      const myBucketDocument = await historyService.getDocument(myBucketId, myDocumentId);
      expect(myBucketDocument).toEqual({
        _id: myDocumentId,
        title: "test title",
        description: "test description"
      });
    });
  });

  describe("history methods", () => {
    describe("get", () => {
      const myBucketId = new ObjectId();
      const myDocumentId = new ObjectId();
      const anotherDocumentId = new ObjectId();

      const myFirstHistoryId = new ObjectId(
        Math.floor(new Date(2018, 11, 22).getTime() / 1000).toString(16) + "0000000000000000"
      );
      const mySecondHistoryId = new ObjectId(
        Math.floor(new Date(2018, 11, 24).getTime() / 1000).toString(16) + "0000000000000000"
      );
      const myThirdHistoryId = new ObjectId(
        Math.floor(new Date(2018, 11, 26).getTime() / 1000).toString(16) + "0000000000000000"
      );

      beforeAll(async () => {
        const myFirstHistory = {
          _id: myFirstHistoryId,
          bucket_id: myBucketId,
          document_id: myDocumentId,
          title: "first history",
          changes: diff({title: "previous title"}, {title: "edited title"})
        };
        const mySecondHistory = {
          _id: mySecondHistoryId,
          bucket_id: myBucketId,
          document_id: myDocumentId,
          title: "second history",
          changes: diff({title: "will be deleted title"}, {description: "new added description"})
        };
        const myThirdHistory = {
          _id: myThirdHistoryId,
          bucket_id: myBucketId,
          document_id: myDocumentId,
          title: "third history",
          changes: diff(
            {},
            {title: "new added title", description: "new added description", name: "new added name"}
          )
        };
        const anotherHistory = {
          bucket_id: myBucketId,
          document_id: anotherDocumentId,
          title: "another document history",
          changes: []
        };

        await historyService.collection.insertMany([
          myFirstHistory,
          mySecondHistory,
          myThirdHistory,
          anotherHistory
        ]);
      });

      afterAll(async () => {
        await historyService.collection.deleteMany({});
      });

      it("should get history from title", async () => {
        const myHistory = await historyService.getHistory({title: "third history"});
        expect(myHistory).toEqual({
          _id: myThirdHistoryId,
          bucket_id: myBucketId,
          document_id: myDocumentId,
          title: "third history",
          changes: diff(
            {},
            {title: "new added title", description: "new added description", name: "new added name"}
          )
        });
      });

      it("should get histories from spesific history to now for spesific bucket document", async () => {
        //first we need to get story which we want
        const myLimitHistoryId = mySecondHistoryId;

        //then we will get histories from spesific history to now
        const myHistories = await historyService.findBetweenNow(
          myBucketId,
          myDocumentId,
          myLimitHistoryId
        );
        expect(myHistories).toEqual([
          {
            _id: myThirdHistoryId,
            bucket_id: myBucketId,
            document_id: myDocumentId,
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
            _id: mySecondHistoryId,
            bucket_id: myBucketId,
            document_id: myDocumentId,
            title: "second history",
            changes: diff({title: "will be deleted title"}, {description: "new added description"})
          }
        ]);
      });

      it("should get all histories of spesific bucket document", async () => {
        const myHistories = await historyService.find({document_id: myDocumentId});
        expect(myHistories).toEqual([
          {
            _id: myThirdHistoryId,
            date: new Date(2018, 11, 26),
            changes: 3
          } as any,
          {
            _id: mySecondHistoryId,
            date: new Date(2018, 11, 24),
            changes: 2
          } as any,
          {
            _id: myFirstHistoryId,
            date: new Date(2018, 11, 22),
            changes: 1
          } as any
        ]);
      });
    });

    describe("delete", () => {
      const myBucketId = new ObjectId();
      const myDocumentId = new ObjectId();
      const anotherDocumentId = new ObjectId();

      beforeEach(async () => {
        const myFirstHistory = {
          bucket_id: myBucketId,
          document_id: myDocumentId,
          title: "first history",
          changes: diff({title: "previous title"}, {title: "edited title"})
        };
        const mySecondHistory = {
          bucket_id: myBucketId,
          document_id: anotherDocumentId,
          title: "second history",
          changes: diff(
            {title: null},
            {title: "new added title", description: "new added description"}
          )
        };
        const myThirdHistory = {
          bucket_id: myBucketId,
          document_id: myDocumentId,
          title: "third history",
          changes: diff({description: ["first,second"]}, {description: ["new first,new second"]})
        };

        await historyService.collection.insertMany([
          myFirstHistory,
          mySecondHistory,
          myThirdHistory
        ]);
      });

      afterEach(async () => {
        await historyService.collection.deleteMany({});
      });

      it("should delete spesific bucket document histories", async () => {
        const response: DeleteWriteOpResultObject = await historyService.deleteMany({
          $and: [{bucket_id: myBucketId}, {document_id: myDocumentId}]
        });
        expect(response.deletedCount).toBe(2);

        const histories = (await historyService.collection.find({}).toArray()).filter(
          history => delete history._id
        );
        expect(histories).toEqual([
          {
            bucket_id: myBucketId,
            document_id: anotherDocumentId,
            title: "second history",
            changes: diff(
              {title: null},
              {title: "new added title", description: "new added description"}
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

      it("should delete histories which contains changes about only title field ,should remove title changes on histories which contains changes about title and more, shouldn't update which doesnt contain changes about title", async () => {
        const response = await historyService.deleteHistoryAtPath(myBucketId, ["title"]);
        expect(response.deletedCount).toBe(1);

        const histories = (await historyService.collection.find({}).toArray()).map(
          history => history.changes
        );
        expect(histories).toEqual([
          diff({}, {description: "new added description"}),
          diff({description: ["first,second"]}, {description: ["new first,new second"]})
        ]);
      });
    });

    describe("insert", () => {
      const myBucketId = new ObjectId();
      const myDocumentId = new ObjectId();

      afterEach(async () => {
        await historyService.collection.deleteMany({});
      });

      it("should delete first history before add new history if history count is ten or more", async () => {
        //fill the collection
        const histories = Array.from(new Array(10), (val, index) => ({
          bucket_id: myBucketId,
          document_id: myDocumentId,
          //index starts with 0
          title: `${index + 1}. history`
        }));
        await historyService.collection.insertMany(histories);

        //add history
        const response: InsertOneWriteOpResult = await historyService.insertOne({
          bucket_id: myBucketId,
          document_id: myDocumentId,
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
          bucket_id: myBucketId,
          document_id: myDocumentId,
          title: "first title"
        });

        const response: InsertOneWriteOpResult = await historyService.insertOne({
          bucket_id: myBucketId,
          document_id: myDocumentId,
          title: "new title"
        });
        expect(response.insertedCount).toBe(1);

        const histories = await historyService.collection.find({}).toArray();
        expect(histories.filter(history => delete history._id)).toEqual([
          {
            bucket_id: myBucketId,
            document_id: myDocumentId,
            title: "first title"
          },
          {
            bucket_id: myBucketId,
            document_id: myDocumentId,
            title: "new title"
          }
        ]);
      });
    });
  });
});
