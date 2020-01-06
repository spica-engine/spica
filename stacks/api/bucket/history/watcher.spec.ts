import {BucketWatcher} from "./watcher";
import {Test, TestingModule} from "@nestjs/testing";
import {
  DatabaseTestingModule,
  DatabaseService,
  ObjectId,
  MongoClient
} from "@spica-server/database/testing";
import {HistoryService} from "./history.service";

describe("Watcher", () => {
  let module: TestingModule;
  let bucketWatcher: BucketWatcher;
  let databaseService: DatabaseService;
  const buckets = [
    {
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
    },
    {
      _id: new ObjectId(),
      title: "New Bucket",
      description: "Describe your new bucket",
      icon: "view_stream",
      primary: "title",
      readOnly: false,
      properties: {
        name: {
          type: "string",
          title: "title",
          description: "Name of the row",
          options: {position: "left", visible: true}
        },
        age: {
          type: "number",
          title: "description",
          description: "Number of the row",
          options: {position: "right"}
        }
      }
    }
  ];

  const firstBucketDocuments = [
    {
      _id: new ObjectId(),
      bucket_id: buckets[0]._id,
      title: "first title",
      description: "first description"
    },
    {
      _id: new ObjectId(),
      bucket_id: buckets[0]._id,
      title: "second title",
      description: "second description"
    }
  ];
  const secondBucketDocuments = [
    {
      _id: new ObjectId(),
      bucket_id: buckets[1]._id,
      name: "first name",
      age: 10
    },
    {
      _id: new ObjectId(),
      bucket_id: buckets[1]._id,
      name: "second name",
      age: 20
    }
  ];

  let deleteManySpy: jasmine.SpyObj<any>;
  let previousSchemaSpy: jasmine.SpyObj<any>;
  let deleteAtPathSpy: jasmine.SpyObj<any>;
  let previousDocumentSpy: jasmine.SpyObj<any>;
  let insertOneSpy: jasmine.SpyObj<any>;

  const mockHistoryService = {
    deleteMany: jasmine.createSpy("deleteMany"),
    getPreviousSchema: jasmine.createSpy("getPreviousSchema"),
    deleteHistoryAtPath: jasmine.createSpy("deleteHistoryAtPath"),
    getPreviousDocument: jasmine.createSpy("getPreviousDocument"),
    insertOne: jasmine.createSpy("insertOne")
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet()],
      providers: [
        {
          provide: HistoryService,
          useValue: mockHistoryService
        }
      ]
    }).compile();

    databaseService = await module.get(DatabaseService);

    //insert buckets
    await databaseService.collection("buckets").insertMany(buckets);
    //insert documents
    await databaseService.collection(`bucket_${buckets[0]._id}`).insertMany(firstBucketDocuments);
    await databaseService.collection(`bucket_${buckets[1]._id}`).insertMany(secondBucketDocuments);
    //create watcher and call watch
    bucketWatcher = new BucketWatcher(module.get(MongoClient), module.get(HistoryService));
    bucketWatcher.watch();
    //wait until watcher initialized
    await new Promise(resolve => setTimeout(resolve, 100));
    //create spies
    deleteManySpy = bucketWatcher["historyService"].deleteMany;
    previousSchemaSpy = bucketWatcher["historyService"].getPreviousSchema;
    deleteAtPathSpy = bucketWatcher["historyService"].deleteHistoryAtPath;
    previousDocumentSpy = bucketWatcher["historyService"].getPreviousDocument;
    insertOneSpy = bucketWatcher["historyService"].insertOne;
  }, 120000);

  afterEach(async () => {
    //delete buckets
    await databaseService
      .collection("buckets")
      .deleteMany({})
      .catch();
    //delete documents
    await databaseService
      .collection(`bucket_${buckets[0]._id}`)
      .deleteMany({})
      .catch();
    await databaseService
      .collection(`bucket_${buckets[1]._id}`)
      .deleteMany({})
      .catch();
    //insert buckets
    await databaseService.collection("buckets").insertMany(buckets);
    //insert documents
    await databaseService.collection(`bucket_${buckets[0]._id}`).insertMany(firstBucketDocuments);
    await databaseService.collection(`bucket_${buckets[1]._id}`).insertMany(secondBucketDocuments);
    //wait until spies called, then reset all of them
    await new Promise(resolve => setTimeout(resolve, 100));
    deleteManySpy.calls.reset();
    previousSchemaSpy.calls.reset();
    deleteAtPathSpy.calls.reset();
    previousDocumentSpy.calls.reset();
    insertOneSpy.calls.reset();
  });

  afterAll(async () => {
    await module.close();
  });

  it("should delete histories of bucket which is deleted", async () => {
    await databaseService.collection("buckets").deleteOne({_id: buckets[1]._id});

    //wait until changes detected
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(deleteManySpy).toHaveBeenCalledWith({
      bucket_id: buckets[1]._id
    });
    expect(deleteManySpy).toHaveBeenCalledTimes(1);
  });

  it("should delete histories of bucket document which is deleted", async () => {
    await databaseService
      .collection(`bucket_${buckets[1]._id}`)
      .deleteOne({_id: secondBucketDocuments[1]._id});

    //wait until changes detected
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(deleteManySpy).toHaveBeenCalledWith({
      document_id: secondBucketDocuments[1]._id
    });
    expect(deleteManySpy).toHaveBeenCalledTimes(1);
  });

  it("should delete histories of bucket which is updated", async () => {
    //update spy as it returns previous bucket schema
    previousSchemaSpy.and.returnValue(Promise.resolve(buckets[0]));

    let updatedBucket = {
      title: "New Bucket",
      description: "Describe your new bucket",
      icon: "view_stream",
      primary: "title",
      readOnly: false,
      properties: {
        updatedTitle: {
          type: "string",
          title: "title",
          description: "Title of the row",
          options: {position: "left", visible: true}
        },
        updatedDescription: {
          type: "textarea",
          title: "description",
          description: "Description of the row",
          options: {position: "right"}
        }
      }
    };
    await databaseService.collection("buckets").replaceOne({_id: buckets[0]._id}, updatedBucket);

    //wait until changes detected
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(previousSchemaSpy).toHaveBeenCalledTimes(1);
    expect(previousSchemaSpy).toHaveBeenCalledWith(buckets[0]._id);

    expect(deleteAtPathSpy).toHaveBeenCalledTimes(2);
    expect(deleteAtPathSpy).toHaveBeenCalledWith(buckets[0]._id, ["title"]);
    expect(deleteAtPathSpy).toHaveBeenCalledWith(buckets[0]._id, ["description"]);
  });

  it("should create new history when bucket document is updated", async () => {
    //update spy as it returns previous bucket document
    previousDocumentSpy.and.returnValue(Promise.resolve(secondBucketDocuments[1]));

    let updatedDocument = {...secondBucketDocuments[1], name: "updated second name", age: 21};

    await databaseService
      .collection(`bucket_${buckets[1]._id}`)
      .replaceOne({_id: updatedDocument._id}, updatedDocument);

    //wait until changes detected
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(previousDocumentSpy).toHaveBeenCalledTimes(1);
    expect(previousDocumentSpy).toHaveBeenCalledWith(buckets[1]._id, secondBucketDocuments[1]._id);

    expect(insertOneSpy).toHaveBeenCalledTimes(1);
    expect(insertOneSpy).toHaveBeenCalledWith({
      bucket_id: buckets[1]._id,
      document_id: secondBucketDocuments[1]._id,
      changes: [
        {
          kind: 1,
          path: ["name"],
          patches: [
            {diffs: [[-1, "updated "], [0, "seco"]], start1: 0, start2: 0, length1: 12, length2: 4}
          ]
        },
        {
          kind: 1,
          path: ["age"],
          patches: [
            {diffs: [[0, "2"], [-1, "1"], [1, "0"]], start1: 0, start2: 0, length1: 2, length2: 2}
          ]
        }
      ]
    });
  });

  it("should throw error when there is no changes between previous and updated documents", async done => {
    //provide only unhandledRejection listener on process is our custom listener then revert changes back
    const listeners = process.listeners("unhandledRejection");
    process.removeAllListeners("unhandledRejection");
    const handleError: NodeJS.UnhandledRejectionListener = (reason, promise) => {
      expect(reason instanceof Error).toBe(true);
      expect(reason["message"]).toBe(
        "Database propagated changes but state of previous and current documents is equal so there is no change in between documents. This usually happens when there is no replication member that has slaveDelay."
      );
      process.removeListener("unhandledRejection", handleError);
      listeners.forEach(l => process.addListener("unhandledRejection", l));
      done();
    };
    process.addListener("unhandledRejection", handleError);

    //update spy as it returns same bucket document
    const updatedDocument = {...firstBucketDocuments[0], title: "new title"};
    previousDocumentSpy.and.returnValue(Promise.resolve(updatedDocument));

    await databaseService
      .collection(`bucket_${buckets[0]._id}`)
      .replaceOne({_id: updatedDocument._id}, updatedDocument);

    //wait until changes detected
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(previousDocumentSpy).toHaveBeenCalledTimes(1);
    expect(previousDocumentSpy).toHaveBeenCalledWith(buckets[0]._id, firstBucketDocuments[0]._id);

    expect(insertOneSpy).toHaveBeenCalledTimes(0);
  }, 35000);
});
