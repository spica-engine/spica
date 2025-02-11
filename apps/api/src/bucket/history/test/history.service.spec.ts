import {TestingModule, Test} from "@nestjs/testing";
import {
  DatabaseTestingModule,
  DatabaseService,
  ObjectId,
  DeleteResult,
  InsertOneResult
} from "@spica-server/database/testing";
import {HistoryService} from "@spica-server/bucket/history";
import {diff} from "@spica-server/core/differ";

describe("History Service", () => {
  let module: TestingModule;
  let historyService: HistoryService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.create()],
      providers: [HistoryService]
    }).compile();
    historyService = module.get(HistoryService);

    //insert bucket and document
    await module.get(DatabaseService).collection("buckets").insertOne(bucket);
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
        const response: DeleteResult = await historyService.deleteMany({
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
        const response: DeleteResult = await historyService.deleteMany({
          document_id: new ObjectId()
        });
        expect(response.deletedCount).toBe(0);
      });

      it("should delete all of them", async () => {
        const response: DeleteResult = await historyService.deleteMany({});
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
        const response: InsertOneResult = await historyService.insertOne({
          bucket_id: bucketId,
          document_id: documentId,
          title: "add me"
        });
        expect(response.acknowledged).toBe(true);

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

      it("should add new history", async () => {
        const response: InsertOneResult = await historyService.createHistory(
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
        expect(response.acknowledged).toBe(true);

        const histories = await historyService.getHistory({
          _id: response.insertedId
        });
        expect(histories).toEqual({
          _id: response.insertedId,
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
        const response: InsertOneResult = await historyService.createHistory(
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
                options: {
                  position: "left"
                }
              },
              age: {
                type: "number",
                options: {
                  position: "left"
                }
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
                options: {
                  position: "left"
                }
              }
            }
          }
        );

        await new Promise(resolve => setTimeout(resolve, 3000));

        const history = await historyService.getHistory({
          _id: response.insertedId
        });
        expect(history).toEqual({
          _id: response.insertedId,
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
