import {Test, TestingModule} from "@nestjs/testing";
import {BucketDataService, BucketService} from "@spica-server/bucket/services";
import {HistoryService} from "@spica-server/bucket/history";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {getApplier, getSupplier} from "../../src/synchronizer/schema/index";
import {
  ChangeLog,
  ChangeOrigin,
  ChangeType,
  SyncStatuses
} from "@spica-server/interface/versioncontrol";
import * as CRUD from "../../src/crud";
import YAML from "yaml";
import {deepCopy} from "@spica-server/core/patch";
import {skip} from "rxjs/operators";
import {firstValueFrom} from "rxjs";

describe("Bucket Synchronizer", () => {
  let module: TestingModule;
  let bs: BucketService;
  let bds: BucketDataService;
  let history: HistoryService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.replicaSet(),
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
    await module.close();
  });

  describe("bucketSupplier", () => {
    let bucketSupplier;

    beforeEach(() => {
      bucketSupplier = getSupplier(bs);
    });

    it("should return Change supplier with correct metadata", () => {
      expect(bucketSupplier).toMatchObject({
        module: "bucket",
        subModule: "schema",
        listen: expect.any(Function)
      });
    });

    it("should emit ChangeLog on initial start", async () => {
      const mockBucket: any = {
        _id: new ObjectId(),
        title: "Test Bucket",
        description: "Test Description",
        icon: "test-icon",
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
      await CRUD.insert(bs, mockBucket);

      const changeLog = await firstValueFrom(bucketSupplier.listen());

      expect(changeLog).toMatchObject({
        module: "bucket",
        sub_module: "schema",
        type: ChangeType.CREATE,
        origin: ChangeOrigin.DOCUMENT,
        resource_id: mockBucket._id.toString(),
        resource_slug: "Test Bucket",
        resource_content: YAML.stringify(mockBucket),
        created_at: expect.any(Date)
      });
    });

    it("should emit ChangeLog on bucket insert", done => {
      const mockBucket: any = {
        _id: new ObjectId(),
        title: "Test Bucket",
        description: "Test Description",
        icon: "test-icon",
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

      const observable = bucketSupplier.listen();

      observable.subscribe(changeLog => {
        expect(changeLog).toMatchObject({
          module: "bucket",
          sub_module: "schema",
          type: ChangeType.CREATE,
          origin: ChangeOrigin.DOCUMENT,
          resource_id: mockBucket._id.toString(),
          resource_slug: "Test Bucket",
          resource_content: YAML.stringify(mockBucket),
          created_at: expect.any(Date)
        });

        done();
      });

      CRUD.insert(bs, mockBucket);
    });

    it("should emit ChangeLog on bucket update", done => {
      const bucketId = new ObjectId();
      const initialBucket: any = {
        _id: bucketId,
        title: "Initial Bucket",
        description: "Initial Description",
        icon: "initial-icon",
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

      let updatedBucket: any = {
        _id: bucketId,
        title: "Updated Bucket",
        description: "Updated Description",
        icon: "updated-icon",
        primary: "title",
        readOnly: false,
        acl: {
          read: "true==true",
          write: "true==true"
        },
        properties: {
          title: {type: "string", options: {}},
          description: {type: "string", options: {}}
        }
      };
      const expectedUpdatedBucket = deepCopy(updatedBucket);

      const observable = bucketSupplier.listen().pipe(skip(1));

      observable.subscribe(changeLog => {
        if (changeLog.type == ChangeType.UPDATE) {
          expect(changeLog).toMatchObject({
            module: "bucket",
            sub_module: "schema",
            type: ChangeType.UPDATE,
            origin: ChangeOrigin.DOCUMENT,
            resource_id: bucketId.toString(),
            resource_slug: "Updated Bucket",
            resource_content: YAML.stringify(expectedUpdatedBucket),
            created_at: expect.any(Date)
          });
          done();
        }
      });

      CRUD.insert(bs, initialBucket).then(() => CRUD.replace(bs, bds, history, updatedBucket));
    });

    it("should emit ChangeLog on bucket delete", done => {
      const bucketId = new ObjectId();
      const bucketToDelete: any = {
        _id: bucketId,
        title: "Bucket To Delete",
        description: "Will be deleted",
        icon: "delete-icon",
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

      const observable = bucketSupplier.listen().pipe(skip(1));

      observable.subscribe(changeLog => {
        if (changeLog.type == ChangeType.DELETE) {
          expect(changeLog).toMatchObject({
            module: "bucket",
            sub_module: "schema",
            type: ChangeType.DELETE,
            origin: ChangeOrigin.DOCUMENT,
            resource_id: bucketId.toString(),
            resource_slug: "Bucket To Delete",
            created_at: expect.any(Date)
          });
          const parsedContent = YAML.parse(changeLog.resource_content);
          expect(parsedContent).toEqual({
            _id: bucketId.toString(),
            title: "Bucket To Delete",
            description: "Will be deleted",
            icon: "delete-icon",
            primary: "title",
            readOnly: false,
            acl: {
              read: "true==true",
              write: "true==true"
            },
            properties: {
              title: {type: "string", options: {}}
            }
          });
          done();
        }
      });

      CRUD.insert(bs, bucketToDelete).then(() => {
        CRUD.remove(bs, bds, history, bucketId.toString());
      });
    });
  });

  describe("bucketApplier", () => {
    let bucketApplier;

    beforeEach(() => {
      bucketApplier = getApplier(bs, bds, history);
    });

    it("should return Change Applier with correct metadata", () => {
      expect(bucketApplier).toMatchObject({
        module: "bucket",
        subModule: "schema",
        apply: expect.any(Function)
      });
    });

    it("should apply insert change successfully", async () => {
      const _id = new ObjectId();
      const mockBucket: any = {
        _id,
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
        type: ChangeType.CREATE,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: mockBucket._id.toString(),
        resource_slug: "New Bucket",
        resource_content: YAML.stringify(mockBucket),
        created_at: new Date(),
        resource_extension: "yaml"
      };

      const result = await bucketApplier.apply(changeLog);

      expect(result).toMatchObject({
        status: SyncStatuses.SUCCEEDED
      });

      const insertedBucket = await bs.findOne({_id: mockBucket._id});
      expect(insertedBucket).toEqual({
        _id,
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
      });
    });

    it("should apply update change successfully", async () => {
      const _id = new ObjectId();
      const existingBucket: any = {
        _id,
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
      await CRUD.insert(bs, existingBucket);
      const updatedBucket: any = {
        _id,
        title: "Updated Bucket",
        description: "Updated Description",
        icon: "updated-icon",
        primary: "title",
        readOnly: false,
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
        type: ChangeType.UPDATE,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: _id.toString(),
        resource_slug: "Updated Bucket",
        resource_content: YAML.stringify(updatedBucket),
        created_at: new Date(),
        resource_extension: "yaml"
      };

      const result = await bucketApplier.apply(changeLog);

      expect(result).toMatchObject({
        status: SyncStatuses.SUCCEEDED
      });

      const bucket = await bs.findOne({_id});
      expect(bucket).toMatchObject({
        _id,
        title: "Updated Bucket",
        description: "Updated Description",
        icon: "updated-icon",
        primary: "title",
        readOnly: false,
        acl: {
          read: "true==true",
          write: "true==true"
        },
        properties: {
          title: {type: "string", options: {}},
          description: {type: "string", options: {}}
        }
      });
    });

    it("should apply delete change successfully", async () => {
      const _id = new ObjectId();
      const mockBucket: any = {
        _id,
        title: "Test Bucket",
        description: "To be deleted",
        icon: "test-icon",
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
      await CRUD.insert(bs, mockBucket);

      const changeLog: ChangeLog = {
        module: "bucket",
        sub_module: "schema",
        type: ChangeType.DELETE,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: _id.toString(),
        resource_slug: null,
        resource_content: "",
        created_at: new Date(),
        resource_extension: "yaml"
      };

      const result = await bucketApplier.apply(changeLog);

      expect(result).toMatchObject({
        status: SyncStatuses.SUCCEEDED
      });

      const bucket = await bs.findOne({_id});
      expect(bucket).toBeNull();
    });

    it("should handle unknown operation type", async () => {
      const changeLog: ChangeLog = {
        module: "bucket",
        sub_module: "schema",
        type: "upsert" as any,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: "123",
        resource_slug: null,
        resource_content: "",
        created_at: new Date(),
        resource_extension: "yaml"
      };

      const result = await bucketApplier.apply(changeLog);

      expect(result).toMatchObject({
        status: SyncStatuses.FAILED,
        reason: "Unknown operation type: upsert"
      });
    });

    it("should handle YAML parse errors", async () => {
      const changeLog: ChangeLog = {
        module: "bucket",
        sub_module: "schema",
        type: ChangeType.CREATE,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: "123",
        resource_slug: "Test",
        resource_content: "invalid: yaml: content:",
        created_at: new Date(),
        resource_extension: "yaml"
      };

      const result = await bucketApplier.apply(changeLog);

      expect(result).toMatchObject({
        status: SyncStatuses.FAILED
      });
      expect(result.reason).toBeDefined();
    });
  });
});
