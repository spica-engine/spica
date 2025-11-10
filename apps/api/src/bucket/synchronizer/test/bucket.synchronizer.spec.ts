import {Test, TestingModule} from "@nestjs/testing";
import {BucketDataService, BucketService} from "@spica-server/bucket/services";
import {HistoryService} from "@spica-server/bucket/history";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {bucketSupplier, bucketApplier} from "../src/bucket.synchronizer";
import {ChangeLog} from "@spica-server/interface/versioncontrol/src/interface";
import YAML from "yaml";
import {EventEmitter} from "events";

describe("Bucket Synchronizer", () => {
  let module: TestingModule;
  let bs: BucketService;
  let bds: BucketDataService;
  let history: HistoryService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.standalone(),
        PreferenceTestingModule,
        SchemaModule.forChild()
      ],
      providers: [BucketService, BucketDataService, HistoryService]
    }).compile();

    bs = module.get(BucketService);
    bds = module.get(BucketDataService);
    history = module.get(HistoryService);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await module.close();
  });

  describe("bucketSupplier", () => {
    it("should return ChangeSupplier with correct metadata", () => {
      const supplier = bucketSupplier(bs);

      expect(supplier).toMatchObject({
        module: "bucket",
        subModule: "schema",
        fileExtension: "yaml"
      });
    });

    it("should emit ChangeLog on bucket insert", done => {
      const supplier = bucketSupplier(bs);
      const mockBucket: any = {
        _id: new ObjectId(),
        title: "Test Bucket",
        description: "Test Description",
        icon: "test-icon",
        primary: "title",
        readOnly: false,
        properties: {
          title: {type: "string", options: {}}
        }
      };

      const mockStream = new EventEmitter();
      jest.spyOn(bs._coll, "watch").mockReturnValue(mockStream as any);

      const observable = supplier.listen();

      observable.subscribe(changeLog => {
        expect(changeLog).toMatchObject({
          module: "bucket",
          sub_module: "schema",
          type: "insert",
          origin: "local",
          resource_id: mockBucket._id.toString(),
          resource_slug: "Test Bucket",
          resource_content: expect.stringContaining("title: Test Bucket"),
          created_at: expect.any(Date)
        });

        done();
      });

      mockStream.emit("change", {
        operationType: "insert",
        fullDocument: mockBucket,
        documentKey: {_id: mockBucket._id}
      });
    });

    it("should emit ChangeLog on bucket update", done => {
      const supplier = bucketSupplier(bs);
      const bucketId = new ObjectId();
      const updatedBucket: any = {
        _id: bucketId,
        title: "Updated Bucket",
        description: "Updated Description",
        icon: "updated-icon",
        primary: "title",
        readOnly: false,
        properties: {
          title: {type: "string", options: {}},
          description: {type: "string", options: {}}
        }
      };

      const mockStream = new EventEmitter();
      jest.spyOn(bs._coll, "watch").mockReturnValue(mockStream as any);

      const observable = supplier.listen();

      observable.subscribe(changeLog => {
        expect(changeLog).toMatchObject({
          module: "bucket",
          sub_module: "schema",
          type: "update",
          origin: "local",
          resource_id: bucketId.toString(),
          resource_slug: "Updated Bucket",
          resource_content: expect.stringContaining("title: Updated Bucket"),
          created_at: expect.any(Date)
        });

        done();
      });

      mockStream.emit("change", {
        operationType: "update",
        fullDocument: updatedBucket,
        documentKey: {_id: bucketId}
      });
    });

    it("should emit ChangeLog on bucket delete", done => {
      const supplier = bucketSupplier(bs);
      const bucketId = new ObjectId();

      const mockStream = new EventEmitter();
      jest.spyOn(bs._coll, "watch").mockReturnValue(mockStream as any);

      const observable = supplier.listen();

      observable.subscribe(changeLog => {
        expect(changeLog).toMatchObject({
          module: "bucket",
          sub_module: "schema",
          type: "delete",
          origin: "local",
          resource_id: bucketId.toString(),
          resource_slug: "",
          resource_content: "",
          created_at: expect.any(Date)
        });

        done();
      });

      mockStream.emit("change", {
        operationType: "delete",
        documentKey: {_id: bucketId}
      });
    });
  });

  describe("bucketApplier", () => {
    it("should return ChangeApplier with correct metadata", () => {
      const applier = bucketApplier(bs, bds, history);

      expect(applier).toMatchObject({
        module: "bucket",
        subModule: "schema",
        fileExtension: "yaml"
      });
    });

    it("should apply insert change successfully", async () => {
      const applier = bucketApplier(bs, bds, history);
      const mockBucket: any = {
        _id: new ObjectId(),
        title: "New Bucket",
        description: "New Description",
        icon: "new-icon",
        primary: "title",
        readOnly: false,
        acl: {
          read: "true==true",
          write: "true==true"
        },
        properties: {
          title: {type: "string", options: {}}
        }
      };

      const changeLog: ChangeLog = {
        module: "bucket",
        sub_module: "schema",
        type: "insert",
        origin: "remote",
        resource_id: mockBucket._id.toString(),
        resource_slug: "New Bucket",
        resource_content: YAML.stringify(mockBucket),
        created_at: new Date()
      };

      const insertOneSpy = jest.spyOn(bs, "insertOne").mockResolvedValue(mockBucket as any);

      const result = await applier.apply(changeLog);

      expect(result).toMatchObject({
        status: "succeeded"
      });
      expect(insertOneSpy).toHaveBeenCalled();
    });

    it("should apply update change successfully", async () => {
      const applier = bucketApplier(bs, bds, history);
      const existingBucket: any = {
        _id: new ObjectId(),
        title: "Old Bucket",
        description: "Old Description",
        icon: "old-icon",
        primary: "title",
        readOnly: false,
        acl: {
          read: "true==true",
          write: "true==true"
        },
        properties: {
          title: {type: "string", options: {}}
        }
      };

      const updatedBucket: any = {
        ...existingBucket,
        title: "Updated Bucket",
        description: "Updated Description",
        acl: {
          read: "true==true",
          write: "true==true"
        },
        properties: {
          title: {type: "string", options: {}},
          description: {type: "string", options: {}}
        }
      };

      const changeLog: ChangeLog = {
        module: "bucket",
        sub_module: "schema",
        type: "update",
        origin: "remote",
        resource_id: updatedBucket._id.toString(),
        resource_slug: "Updated Bucket",
        resource_content: YAML.stringify(updatedBucket),
        created_at: new Date()
      };

      const findOneAndReplaceSpy = jest
        .spyOn(bs, "findOneAndReplace")
        .mockResolvedValue(updatedBucket as any);

      const result = await applier.apply(changeLog);

      expect(result).toMatchObject({
        status: "succeeded"
      });
      expect(findOneAndReplaceSpy).toHaveBeenCalled();
    });

    it("should apply delete change successfully", async () => {
      const applier = bucketApplier(bs, bds, history);
      const bucketId = new ObjectId();
      const mockBucket: any = {
        _id: bucketId,
        title: "Test"
      };

      const changeLog: ChangeLog = {
        module: "bucket",
        sub_module: "schema",
        type: "delete",
        origin: "remote",
        resource_id: bucketId.toString(),
        resource_slug: "",
        resource_content: "",
        created_at: new Date()
      };

      const dropSpy = jest.spyOn(bs, "drop").mockResolvedValue(mockBucket as any);

      const result = await applier.apply(changeLog);

      expect(result).toMatchObject({
        status: "succeeded"
      });
      expect(dropSpy).toHaveBeenCalled();
    });

    it("should handle unknown operation type", async () => {
      const applier = bucketApplier(bs, bds, history);

      const changeLog: ChangeLog = {
        module: "bucket",
        sub_module: "schema",
        type: "unknown",
        origin: "remote",
        resource_id: "123",
        resource_slug: "",
        resource_content: "{}",
        created_at: new Date()
      };

      const result = await applier.apply(changeLog);

      expect(result).toMatchObject({
        status: "failed",
        reason: "Unknown operation type: unknown"
      });
    });

    it("should handle YAML parse errors", async () => {
      const applier = bucketApplier(bs, bds, history);

      const changeLog: ChangeLog = {
        module: "bucket",
        sub_module: "schema",
        type: "insert",
        origin: "remote",
        resource_id: "123",
        resource_slug: "Test",
        resource_content: "invalid: yaml: content:",
        created_at: new Date()
      };

      const result = await applier.apply(changeLog);

      expect(result).toMatchObject({
        status: "failed"
      });
      expect(result.reason).toBeDefined();
    });
  });
});
