import {Test, TestingModule} from "@nestjs/testing";
import {PolicyService} from "../../../src/policy.service";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";

import {
  ChangeLog,
  ChangeOrigin,
  ChangeType,
  SyncStatuses
} from "@spica-server/interface/versioncontrol";
import YAML from "yaml";
import {deepCopy} from "@spica-server/core/patch";
import {applier, supplier} from "../src";
import {firstValueFrom, take} from "rxjs";

describe("Policy Synchronizer", () => {
  let module: TestingModule;
  let ps: PolicyService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet()],
      providers: [PolicyService]
    }).compile();

    ps = module.get(PolicyService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe("policySupplier", () => {
    let policySupplier;

    beforeEach(() => {
      policySupplier = supplier(ps);
    });

    it("should return Change Supplier with correct metadata", () => {
      expect(policySupplier).toMatchObject({
        module: "policy",
        subModule: "schema",
        fileExtension: "yaml",
        listen: expect.any(Function)
      });
    });

    it("should emit ChangeLog on initial start", async () => {
      const mockPolicy: any = {
        _id: new ObjectId(),
        name: "Test Policy",
        description: "Test Description",
        statement: [
          {
            action: "bucket:index",
            resource: {
              include: ["*"],
              exclude: []
            },
            module: "bucket"
          }
        ]
      };
      await ps.insertOne(mockPolicy);

      const changeLog = await firstValueFrom(policySupplier.listen());

      expect(changeLog).toMatchObject({
        module: "policy",
        sub_module: "schema",
        type: ChangeType.CREATE,
        origin: ChangeOrigin.DOCUMENT,
        resource_id: mockPolicy._id.toString(),
        resource_slug: "Test Policy",
        resource_content: YAML.stringify(mockPolicy),
        created_at: expect.any(Date)
      });
    });

    it("should emit ChangeLog on policy insert", done => {
      const mockPolicy: any = {
        _id: new ObjectId(),
        name: "Test Policy",
        description: "Test Description",
        statement: [
          {
            action: "bucket:index",
            resource: {
              include: ["*"],
              exclude: []
            },
            module: "bucket"
          }
        ]
      };

      const observable = policySupplier.listen();

      observable.subscribe(changeLog => {
        expect(changeLog).toMatchObject({
          module: "policy",
          sub_module: "schema",
          type: ChangeType.CREATE,
          origin: ChangeOrigin.DOCUMENT,
          resource_id: mockPolicy._id.toString(),
          resource_slug: "Test Policy",
          resource_content: YAML.stringify(mockPolicy),
          created_at: expect.any(Date)
        });

        done();
      });

      ps.insertOne(mockPolicy);
    });

    it("should emit ChangeLog on policy update", done => {
      const policyId = new ObjectId();
      const initialPolicy: any = {
        _id: policyId,
        name: "Initial Policy",
        description: "Initial Description",
        statement: [
          {
            action: "bucket:index",
            resource: {
              include: ["*"],
              exclude: []
            },
            module: "bucket"
          }
        ]
      };

      let updatedPolicy: any = {
        _id: policyId,
        name: "Updated Policy",
        description: "Updated Description",
        statement: [
          {
            action: "bucket:index",
            resource: {
              include: ["*"],
              exclude: []
            },
            module: "bucket"
          },
          {
            action: "function:index",
            resource: {
              include: ["*"],
              exclude: []
            },
            module: "function"
          }
        ]
      };
      const expectedUpdatedPolicy = deepCopy(updatedPolicy);

      const observable = policySupplier.listen();

      observable.subscribe(changeLog => {
        if (changeLog.type == ChangeType.UPDATE) {
          expect(changeLog).toMatchObject({
            module: "policy",
            sub_module: "schema",
            type: ChangeType.UPDATE,
            origin: ChangeOrigin.DOCUMENT,
            resource_id: policyId.toString(),
            resource_slug: "Updated Policy",
            resource_content: YAML.stringify(expectedUpdatedPolicy),
            created_at: expect.any(Date)
          });
          done();
        }
      });

      (async () => {
        await ps.insertOne(initialPolicy);
        await ps.replaceOne({_id: policyId}, updatedPolicy);
      })().catch(err => done(err));
    });

    it("should emit ChangeLog on policy delete", done => {
      const policyId = new ObjectId();
      const policyToDelete: any = {
        _id: policyId,
        name: "Policy To Delete",
        description: "Will be deleted",
        statement: [
          {
            action: "bucket:index",
            resource: {
              include: ["*"],
              exclude: []
            },
            module: "bucket"
          }
        ]
      };

      const observable = policySupplier.listen();

      observable.subscribe(changeLog => {
        if (changeLog.type == ChangeType.DELETE) {
          expect(changeLog).toMatchObject({
            module: "policy",
            sub_module: "schema",
            type: ChangeType.DELETE,
            origin: ChangeOrigin.DOCUMENT,
            resource_id: policyId.toString(),
            resource_slug: null,
            resource_content: "",
            created_at: expect.any(Date)
          });

          done();
        }
      });

      (async () => {
        await ps.insertOne(policyToDelete);
        await ps.deleteOne({_id: policyId});
      })().catch(err => done(err));
    });
  });

  describe("policy Applier", () => {
    let policyApplier;

    beforeEach(() => {
      policyApplier = applier(ps, undefined, undefined);
    });

    it("should return Change Applier with correct metadata", () => {
      expect(policyApplier).toMatchObject({
        module: "policy",
        subModule: "schema",
        fileExtension: "yaml",
        apply: expect.any(Function)
      });
    });

    it("should apply insert change successfully", async () => {
      const _id = new ObjectId();
      const mockPolicy: any = {
        _id,
        name: "New Policy",
        description: "New Description",
        statement: [
          {
            action: "bucket:index",
            resource: {
              include: ["*"],
              exclude: []
            },
            module: "bucket"
          }
        ]
      };

      const changeLog: ChangeLog = {
        module: "policy",
        sub_module: "schema",
        type: ChangeType.CREATE,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: mockPolicy._id.toString(),
        resource_slug: "New Policy",
        resource_content: YAML.stringify(mockPolicy),
        created_at: new Date()
      };

      const result = await policyApplier.apply(changeLog);

      expect(result).toMatchObject({
        status: SyncStatuses.SUCCEEDED
      });

      const insertedPolicy = await ps.findOne({_id: mockPolicy._id});
      expect(insertedPolicy).toEqual({
        _id,
        name: "New Policy",
        description: "New Description",
        statement: [
          {
            action: "bucket:index",
            resource: {
              include: ["*"],
              exclude: []
            },
            module: "bucket"
          }
        ]
      });
    });

    it("should apply update change successfully", async () => {
      const _id = new ObjectId();
      const existingPolicy: any = {
        _id,
        name: "Old Policy",
        description: "Old Description",
        statement: [
          {
            action: "bucket:index",
            resource: {
              include: ["*"],
              exclude: []
            },
            module: "bucket"
          }
        ]
      };
      await ps.insertOne(existingPolicy);

      const updatedPolicy: any = {
        _id,
        name: "Updated Policy",
        description: "Updated Description",
        statement: [
          {
            action: "bucket:index",
            resource: {
              include: ["*"],
              exclude: []
            },
            module: "bucket"
          },
          {
            action: "function:index",
            resource: {
              include: ["*"],
              exclude: []
            },
            module: "function"
          }
        ]
      };

      const changeLog: ChangeLog = {
        module: "policy",
        sub_module: "schema",
        type: ChangeType.UPDATE,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: _id.toString(),
        resource_slug: "Updated Policy",
        resource_content: YAML.stringify(updatedPolicy),
        created_at: new Date()
      };

      const result = await policyApplier.apply(changeLog);

      expect(result).toMatchObject({
        status: SyncStatuses.SUCCEEDED
      });

      const policy = await ps.findOne({_id});
      expect(policy).toMatchObject({
        _id,
        name: "Updated Policy",
        description: "Updated Description",
        statement: [
          {
            action: "bucket:index",
            resource: {
              include: ["*"],
              exclude: []
            },
            module: "bucket"
          },
          {
            action: "function:index",
            resource: {
              include: ["*"],
              exclude: []
            },
            module: "function"
          }
        ]
      });
    });

    it("should apply delete change successfully", async () => {
      const _id = new ObjectId();
      const mockPolicy: any = {
        _id,
        name: "Test Policy",
        description: "To be deleted",
        statement: [
          {
            action: "bucket:index",
            resource: {
              include: ["*"],
              exclude: []
            },
            module: "bucket"
          }
        ]
      };
      await ps.insertOne(mockPolicy);

      const changeLog: ChangeLog = {
        module: "policy",
        sub_module: "schema",
        type: ChangeType.DELETE,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: _id.toString(),
        resource_slug: null,
        resource_content: "",
        created_at: new Date()
      };

      const result = await policyApplier.apply(changeLog);

      expect(result).toMatchObject({
        status: SyncStatuses.SUCCEEDED
      });

      const policy = await ps.findOne({_id: _id.toString()});
      expect(policy).toBeNull();
    });

    it("should handle unknown operation type", async () => {
      const changeLog: ChangeLog = {
        module: "policy",
        sub_module: "schema",
        type: "upsert" as any,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: "123",
        resource_slug: null,
        resource_content: "",
        created_at: new Date()
      };

      const result = await policyApplier.apply(changeLog);

      expect(result).toMatchObject({
        status: SyncStatuses.FAILED,
        reason: "Unknown operation type: upsert"
      });
    });

    it("should handle YAML parse errors", async () => {
      const changeLog: ChangeLog = {
        module: "policy",
        sub_module: "schema",
        type: ChangeType.CREATE,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: "123",
        resource_slug: "Test",
        resource_content: "invalid: yaml: content:",
        created_at: new Date()
      };

      const result = await policyApplier.apply(changeLog);

      expect(result).toMatchObject({
        status: SyncStatuses.FAILED
      });
      expect(result.reason).toBeDefined();
    });
  });
});
