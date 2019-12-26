import {BucketWatcher} from "./watcher";
import {Test, TestingModule} from "@nestjs/testing";
import {
  DatabaseTestingModule,
  DatabaseService,
  ObjectId,
  MongoClient
} from "@spica-server/database/testing";
import {HistoryService} from "./history.service";

describe("Watcher unit", () => {
  let module: TestingModule;
  let bucketWatcher: BucketWatcher;
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

  const mockHistoryService = {
    deleteMany: jasmine.createSpy("deleteMany"),
    getPreviousSchema: jasmine
      .createSpy("getPreviousSchema")
      .and.returnValue(Promise.resolve(buckets[0])),
    deleteHistoryAtPath: jasmine.createSpy("deleteHistoryAtPath")
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
    //insert buckets
    await module
      .get(DatabaseService)
      .collection("buckets")
      .insertMany(buckets);
    //insert documents
    await module
      .get(DatabaseService)
      .collection(`bucket_${buckets[0]._id}`)
      .insertMany(firstBucketDocuments);
    await module
      .get(DatabaseService)
      .collection(`bucket_${buckets[1]._id}`)
      .insertMany(secondBucketDocuments);
    //create watcher and call watch
    bucketWatcher = new BucketWatcher(module.get(MongoClient), module.get(HistoryService));
    bucketWatcher.watch();
    //wait until watcher initialized
    await new Promise(resolve => setTimeout(resolve, 100));
  }, 30000);

  afterAll(async () => {
    await module.close();
  });

  it("should delete histories of bucket which is deleted", async () => {
    await module
      .get(DatabaseService)
      .collection("buckets")
      .deleteOne({_id: buckets[1]._id});
    //wait until changes detected
    await new Promise(resolve => setTimeout(resolve, 100));
    const deleteManySpy = bucketWatcher["historyService"].deleteMany;
    expect(deleteManySpy).toHaveBeenCalledWith({
      bucket_id: buckets[1]._id
    });
    expect(deleteManySpy).toHaveBeenCalledTimes(1);
    deleteManySpy.calls.reset();
  });

  it("should delete histories of bucket document which is deleted", async () => {
    await module
      .get(DatabaseService)
      .collection(`bucket_${buckets[1]._id}`)
      .deleteOne({_id: secondBucketDocuments[1]._id});
    //wait until changes detected
    await new Promise(resolve => setTimeout(resolve, 100));

    const deleteManySpy = bucketWatcher["historyService"].deleteMany;
    expect(deleteManySpy).toHaveBeenCalledWith({
      document_id: secondBucketDocuments[1]._id
    });
    expect(deleteManySpy).toHaveBeenCalledTimes(1);
    deleteManySpy.calls.reset();
  });

  it("should delete histories of bucket which is updated", async () => {
    let updatedBucket = {
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
        updatedField: {
          type: "textarea",
          title: "description",
          description: "Description of the row",
          options: {position: "right"}
        }
      }
    };
    await module
      .get(DatabaseService)
      .collection("buckets")
      .replaceOne({_id: buckets[0]._id}, updatedBucket);
    //wait until changes detected
    await new Promise(resolve => setTimeout(resolve, 100));

    const previousSchemaSpy = bucketWatcher["historyService"].getPreviousSchema;
    expect(previousSchemaSpy).toHaveBeenCalledTimes(1);
    expect(previousSchemaSpy).toHaveBeenCalledWith(buckets[0]._id);

    const deleteAtPathSpy = bucketWatcher["historyService"].deleteHistoryAtPath;
    expect(deleteAtPathSpy).toHaveBeenCalledTimes(1);
    expect(deleteAtPathSpy).toHaveBeenCalledWith(buckets[0]._id, ["description"]);
  });
});
