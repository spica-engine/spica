import {TestingModule, Test} from "@nestjs/testing";
import {
  DatabaseTestingModule,
  DatabaseService,
  ObjectId,
  DeleteWriteOpResultObject
} from "@spica-server/database/testing";
import {HistoryService} from "./history.service";

describe("History Service", () => {
  let module: TestingModule;
  let historyService: HistoryService;

  async function addBucket(bucket: any) {}

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
      beforeAll(async () => {
        const myFirstHistory = {
          title: "first history",
          changes: [],
          date: new Date(2018, 11, 22)
        };
        const mySecondHistory = {
          title: "second history",
          changes: [],
          date: new Date(2018, 11, 24)
        };
        const myThirdHistory = {
          title: "third history",
          changes: [],
          date: new Date(2018, 11, 26)
        };

        //we need to insert stories one by one cause of id value calculates by inserted date
        await historyService.collection.insertOne(myFirstHistory);
        await historyService.collection.insertOne(mySecondHistory);
        await historyService.collection.insertOne(myThirdHistory);
      });

      afterAll(async () => {
        await historyService.collection.deleteMany({});
      });

      it("should get history from title", async () => {
        let myHistory = await historyService.getHistory({title: "third history"});
        delete myHistory._id;
        expect(myHistory).toEqual({
          title: "third history",
          changes: [],
          date: new Date(2018, 11, 26)
        });
      });

      it("should get histories from spesific history to now", async () => {
        //first we need to get story which is we want
        const myLimitHistoryId = (await historyService.getHistory({title: "second history"}))._id;

        //then we will get histories from spesific histories to now
        let myHistories = await historyService.findBetweenNow(new ObjectId(myLimitHistoryId));
        expect(myHistories.filter(history => delete history._id)).toEqual([
          {
            title: "third history",
            changes: [],
            date: new Date(2018, 11, 26)
          },
          {
            title: "second history",
            changes: [],
            date: new Date(2018, 11, 24)
          }
        ]);
      });
    });

    describe("delete", () => {
      beforeAll(async () => {
        const myFirstHistory = {
          title: "first history",
          changes: [],
          date: new Date(2018, 11, 22)
        };
        const mySecondHistory = {
          title: "second history",
          changes: [],
          date: new Date(2018, 11, 24)
        };
        const myThirdHistory = {
          title: "third history",
          changes: [],
          date: new Date(2018, 11, 26)
        };

        //we need to insert stories one by one cause of id value calculates by inserted date
        await historyService.collection.insertOne(myFirstHistory);
        await historyService.collection.insertOne(mySecondHistory);
        await historyService.collection.insertOne(myThirdHistory);
      });

      afterAll(async () => {
        await historyService.collection.deleteMany({});
      });

      xit("it should delete multiple history", async () => {
        const response: DeleteWriteOpResultObject = await historyService.deleteMany({
          title: ["second history", "third history"]
        });

        expect(response).toEqual({} as any);
        expect(historyService.collection.find({})).toEqual({} as any);
      });
    });
  });
});
