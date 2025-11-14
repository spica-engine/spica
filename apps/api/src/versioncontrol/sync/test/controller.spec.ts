import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {SyncModule} from "../src/sync.module";
import {SyncService} from "@spica-server/versioncontrol/services/sync";
import {Sync, SyncStatuses, ChangeType, ChangeOrigin} from "@spica-server/interface/versioncontrol";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {OBJECT_ID} from "@spica-server/core/schema/formats";

describe("Sync Controller", () => {
  let app: INestApplication;
  let req: Request;
  let syncService: SyncService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.standalone(),
        CoreTestingModule,
        PassportTestingModule.initialize(),
        SchemaModule.forRoot({formats: [OBJECT_ID]}),
        SyncModule
      ]
    }).compile();

    app = module.createNestApplication();
    req = module.get(Request);
    syncService = module.get(SyncService);

    await app.listen(req.socket);
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /versioncontrol/sync", () => {
    it("should return empty array when no syncs exist", async () => {
      const res = await req.get("/versioncontrol/sync", {});
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("should return all sync records", async () => {
      const now = new Date();
      const syncRecords: Partial<Sync>[] = [
        {
          change_log: {
            module: "bucket",
            sub_module: "test_bucket",
            type: ChangeType.CREATE,
            origin: ChangeOrigin.DOCUMENT,
            resource_id: "resource1",
            resource_slug: "test-slug-1",
            resource_content: "content1",
            created_at: new Date(now.getTime() - 2000)
          },
          status: SyncStatuses.PENDING,
          created_at: new Date(now.getTime() - 2000),
          updated_at: new Date(now.getTime() - 2000)
        },
        {
          change_log: {
            module: "function",
            sub_module: "test_function",
            type: ChangeType.UPDATE,
            origin: ChangeOrigin.DOCUMENT,
            resource_id: "resource2",
            resource_slug: "test-slug-2",
            resource_content: "content2",
            created_at: new Date(now.getTime() - 1000)
          },
          status: SyncStatuses.PENDING,
          created_at: new Date(now.getTime() - 1000),
          updated_at: new Date(now.getTime() - 1000)
        }
      ];

      await syncService.insertMany(syncRecords as Sync[]);

      const {statusCode, body} = await req.get("/versioncontrol/sync", {
        sort: JSON.stringify({created_at: 1})
      });

      expect(statusCode).toBe(200);
      expect(body).toHaveLength(2);
      expect(body[0]).toMatchObject({
        change_log: {
          module: "bucket",
          sub_module: "test_bucket",
          type: ChangeType.CREATE,
          origin: ChangeOrigin.DOCUMENT,
          resource_id: "resource1",
          resource_slug: "test-slug-1",
          resource_content: "content1"
        },
        status: SyncStatuses.PENDING
      });
      expect(body[1]).toMatchObject({
        change_log: {
          module: "function",
          sub_module: "test_function",
          type: ChangeType.UPDATE,
          origin: ChangeOrigin.DOCUMENT,
          resource_id: "resource2",
          resource_slug: "test-slug-2",
          resource_content: "content2"
        },
        status: SyncStatuses.PENDING
      });
    });

    fit("should apply filter by created_at", async () => {
      const now = new Date();
      const olderDate = new Date(now.getTime() - 2000);
      const newerDate = new Date(now.getTime() - 1000);
      const filterDate = new Date(now.getTime() - 1500);

      const syncRecords: Partial<Sync>[] = [
        {
          change_log: {
            module: "bucket",
            sub_module: "test",
            type: ChangeType.CREATE,
            origin: ChangeOrigin.DOCUMENT,
            resource_id: "resource1",
            resource_slug: "slug-1",
            resource_content: "content1",
            created_at: olderDate
          },
          status: SyncStatuses.PENDING,
          created_at: olderDate,
          updated_at: olderDate
        },
        {
          change_log: {
            module: "function",
            sub_module: "test",
            type: ChangeType.CREATE,
            origin: ChangeOrigin.DOCUMENT,
            resource_id: "resource2",
            resource_slug: "slug-2",
            resource_content: "content2",
            created_at: newerDate
          },
          status: SyncStatuses.PENDING,
          created_at: newerDate,
          updated_at: newerDate
        }
      ];

      await syncService.insertMany(syncRecords as Sync[]);
      const data = await syncService.find({});
      console.log("Inserted sync records:", data);
      const {statusCode, body} = await req.get("/versioncontrol/sync", {
        filter: JSON.stringify({
          created_at: {
            $gte: filterDate
          }
        })
      });

      expect(statusCode).toBe(200);
      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({
        change_log: {
          module: "function",
          sub_module: "test",
          type: ChangeType.CREATE,
          origin: ChangeOrigin.DOCUMENT,
          resource_id: "resource2",
          resource_slug: "slug-2",
          resource_content: "content2"
        },
        status: SyncStatuses.PENDING
      });
    });

    it("should filter syncs by status", async () => {
      const now = new Date();
      const pendingSync: Partial<Sync> = {
        change_log: {
          module: "bucket",
          sub_module: "test",
          type: ChangeType.CREATE,
          origin: ChangeOrigin.DOCUMENT,
          resource_id: "resource1",
          resource_slug: "test-slug",
          resource_content: "content",
          created_at: new Date(now.getTime() - 2000)
        },
        status: SyncStatuses.PENDING,
        created_at: new Date(now.getTime() - 2000),
        updated_at: new Date(now.getTime() - 2000)
      };

      const approvedSync: Partial<Sync> = {
        change_log: {
          module: "function",
          sub_module: "approved_test",
          type: ChangeType.UPDATE,
          origin: ChangeOrigin.DOCUMENT,
          resource_id: "resource2",
          resource_slug: "test-slug-2",
          resource_content: "content2",
          created_at: new Date(now.getTime() - 1000)
        },
        status: SyncStatuses.APPROVED,
        created_at: new Date(now.getTime() - 1000),
        updated_at: new Date(now.getTime() - 1000)
      };

      await syncService.insertMany([pendingSync, approvedSync] as Sync[]);

      const {statusCode, body} = await req.get("/versioncontrol/sync", {
        filter: JSON.stringify({status: SyncStatuses.PENDING})
      });

      expect(statusCode).toBe(200);
      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({
        change_log: {
          module: "bucket",
          sub_module: "test",
          type: ChangeType.CREATE,
          origin: ChangeOrigin.DOCUMENT,
          resource_id: "resource1",
          resource_slug: "test-slug",
          resource_content: "content"
        },
        status: SyncStatuses.PENDING
      });
    });

    it("should apply skip", async () => {
      const now = new Date();
      const syncRecords: Partial<Sync>[] = [
        {
          change_log: {
            module: "bucket",
            sub_module: "first",
            type: ChangeType.CREATE,
            origin: ChangeOrigin.DOCUMENT,
            resource_id: "resource1",
            resource_slug: "slug-1",
            resource_content: "content1",
            created_at: new Date(now.getTime() - 2000)
          },
          status: SyncStatuses.PENDING,
          created_at: new Date(now.getTime() - 2000),
          updated_at: new Date(now.getTime() - 2000)
        },
        {
          change_log: {
            module: "function",
            sub_module: "second",
            type: ChangeType.UPDATE,
            origin: ChangeOrigin.DOCUMENT,
            resource_id: "resource2",
            resource_slug: "slug-2",
            resource_content: "content2",
            created_at: new Date(now.getTime() - 1000)
          },
          status: SyncStatuses.PENDING,
          created_at: new Date(now.getTime() - 1000),
          updated_at: new Date(now.getTime() - 1000)
        }
      ];

      await syncService.insertMany(syncRecords as Sync[]);

      const {statusCode, body} = await req.get("/versioncontrol/sync", {
        skip: 1,
        sort: JSON.stringify({created_at: 1})
      });

      expect(statusCode).toBe(200);
      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({
        change_log: {
          module: "function",
          sub_module: "second",
          type: ChangeType.UPDATE,
          origin: ChangeOrigin.DOCUMENT,
          resource_id: "resource2",
          resource_slug: "slug-2",
          resource_content: "content2"
        },
        status: SyncStatuses.PENDING
      });
    });

    it("should apply skip and limit", async () => {
      const now = new Date();
      const syncRecords: Partial<Sync>[] = [
        {
          change_log: {
            module: "bucket",
            sub_module: "first_sync",
            type: ChangeType.CREATE,
            origin: ChangeOrigin.DOCUMENT,
            resource_id: "resource1",
            resource_slug: "slug-1",
            resource_content: "content1",
            created_at: new Date(now.getTime() - 3000)
          },
          status: SyncStatuses.PENDING,
          created_at: new Date(now.getTime() - 3000),
          updated_at: new Date(now.getTime() - 3000)
        },
        {
          change_log: {
            module: "function",
            sub_module: "second_sync",
            type: ChangeType.UPDATE,
            origin: ChangeOrigin.DOCUMENT,
            resource_id: "resource2",
            resource_slug: "slug-2",
            resource_content: "content2",
            created_at: new Date(now.getTime() - 2000)
          },
          status: SyncStatuses.APPROVED,
          created_at: new Date(now.getTime() - 2000),
          updated_at: new Date(now.getTime() - 2000)
        },
        {
          change_log: {
            module: "storage",
            sub_module: "third_sync",
            type: ChangeType.DELETE,
            origin: ChangeOrigin.DOCUMENT,
            resource_id: "resource3",
            resource_slug: "slug-3",
            resource_content: "content3",
            created_at: new Date(now.getTime() - 1000)
          },
          status: SyncStatuses.PENDING,
          created_at: new Date(now.getTime() - 1000),
          updated_at: new Date(now.getTime() - 1000)
        }
      ];

      await syncService.insertMany(syncRecords as Sync[]);

      const {statusCode, body} = await req.get("/versioncontrol/sync", {
        skip: 1,
        limit: 1,
        sort: JSON.stringify({created_at: 1})
      });

      expect(statusCode).toBe(200);
      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({
        change_log: {
          module: "function",
          sub_module: "second_sync",
          type: ChangeType.UPDATE,
          origin: ChangeOrigin.DOCUMENT,
          resource_id: "resource2",
          resource_slug: "slug-2",
          resource_content: "content2"
        },
        status: SyncStatuses.APPROVED
      });
    });

    it("should apply sorting", async () => {
      const now = new Date();
      const syncRecords: Partial<Sync>[] = [
        {
          change_log: {
            module: "bucket",
            sub_module: "first",
            type: ChangeType.CREATE,
            origin: ChangeOrigin.DOCUMENT,
            resource_id: "resource1",
            resource_slug: "slug-1",
            resource_content: "content1",
            created_at: new Date(now.getTime() - 2000)
          },
          status: SyncStatuses.PENDING,
          created_at: new Date(now.getTime() - 2000),
          updated_at: new Date(now.getTime() - 2000)
        },
        {
          change_log: {
            module: "bucket",
            sub_module: "second",
            type: ChangeType.CREATE,
            origin: ChangeOrigin.DOCUMENT,
            resource_id: "resource2",
            resource_slug: "slug-2",
            resource_content: "content2",
            created_at: new Date(now.getTime() - 1000)
          },
          status: SyncStatuses.PENDING,
          created_at: new Date(now.getTime() - 1000),
          updated_at: new Date(now.getTime() - 1000)
        }
      ];

      await syncService.insertMany(syncRecords as Sync[]);

      const {statusCode, body} = await req.get("/versioncontrol/sync", {
        sort: JSON.stringify({created_at: -1})
      });

      expect(statusCode).toBe(200);
      expect(body).toHaveLength(2);
      expect(body[0]).toMatchObject({
        change_log: {
          module: "bucket",
          sub_module: "second",
          type: ChangeType.CREATE,
          origin: ChangeOrigin.DOCUMENT,
          resource_id: "resource2",
          resource_slug: "slug-2",
          resource_content: "content2"
        },
        status: SyncStatuses.PENDING
      });
      expect(body[1]).toMatchObject({
        change_log: {
          module: "bucket",
          sub_module: "first",
          type: ChangeType.CREATE,
          origin: ChangeOrigin.DOCUMENT,
          resource_id: "resource1",
          resource_slug: "slug-1",
          resource_content: "content1"
        },
        status: SyncStatuses.PENDING
      });
    });

    it("should filter by module", async () => {
      const now = new Date();
      const syncRecords: Partial<Sync>[] = [
        {
          change_log: {
            module: "bucket",
            sub_module: "test",
            type: ChangeType.CREATE,
            origin: ChangeOrigin.DOCUMENT,
            resource_id: "resource1",
            resource_slug: "slug-1",
            resource_content: "content1",
            created_at: new Date(now.getTime() - 2000)
          },
          status: SyncStatuses.PENDING,
          created_at: new Date(now.getTime() - 2000),
          updated_at: new Date(now.getTime() - 2000)
        },
        {
          change_log: {
            module: "function",
            sub_module: "test",
            type: ChangeType.CREATE,
            origin: ChangeOrigin.DOCUMENT,
            resource_id: "resource2",
            resource_slug: "slug-2",
            resource_content: "content2",
            created_at: new Date(now.getTime() - 1000)
          },
          status: SyncStatuses.PENDING,
          created_at: new Date(now.getTime() - 1000),
          updated_at: new Date(now.getTime() - 1000)
        }
      ];

      await syncService.insertMany(syncRecords as Sync[]);

      const {statusCode, body} = await req.get("/versioncontrol/sync", {
        filter: JSON.stringify({"change_log.module": "bucket"}),
        sort: JSON.stringify({created_at: 1})
      });

      expect(statusCode).toBe(200);
      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({
        change_log: {
          module: "bucket",
          sub_module: "test",
          type: ChangeType.CREATE,
          origin: ChangeOrigin.DOCUMENT,
          resource_id: "resource1",
          resource_slug: "slug-1",
          resource_content: "content1"
        },
        status: SyncStatuses.PENDING
      });
    });
  });

  describe("PUT /versioncontrol/sync/:id", () => {
    let testSync: Sync;

    beforeEach(async () => {
      const syncRecord: Partial<Sync> = {
        change_log: {
          module: "bucket",
          sub_module: "test_bucket",
          type: ChangeType.CREATE,
          origin: ChangeOrigin.DOCUMENT,
          resource_id: "resource1",
          resource_slug: "test-slug",
          resource_content: "content",
          created_at: new Date()
        },
        status: SyncStatuses.PENDING,
        created_at: new Date(),
        updated_at: new Date()
      };

      testSync = await syncService.insertOne(syncRecord as Sync);
    });

    it("should approve a pending sync", async () => {
      const {statusCode, body} = await req.put(`/versioncontrol/sync/${testSync._id}`, {
        status: SyncStatuses.APPROVED
      });

      expect([statusCode, body]).toEqual([
        200,
        expect.objectContaining({
          _id: testSync._id.toString(),
          status: SyncStatuses.APPROVED
        })
      ]);
    });

    it("should reject a pending sync", async () => {
      const {statusCode, body} = await req.put(`/versioncontrol/sync/${testSync._id}`, {
        status: SyncStatuses.REJECTED
      });

      expect([statusCode, body.status]).toEqual([200, SyncStatuses.REJECTED]);
    });

    it("should return 400 for invalid status", async () => {
      const {statusCode, body} = await req
        .put(`/versioncontrol/sync/${testSync._id}`, {
          status: SyncStatuses.IN_PROGRESS
        })
        .catch(r => r);

      expect([statusCode, body.message]).toEqual([400, expect.stringContaining("Invalid status")]);
    });

    it("should return 404 for non-existent sync", async () => {
      const fakeId = new ObjectId();
      const {statusCode, body} = await req
        .put(`/versioncontrol/sync/${fakeId}`, {
          status: SyncStatuses.APPROVED
        })
        .catch(r => r);

      expect([statusCode, body.message]).toEqual([404, expect.stringContaining("does not exist")]);
    });

    it("should return 400 when trying to update non-pending sync", async () => {
      await syncService.findOneAndUpdate(
        {_id: testSync._id},
        {$set: {status: SyncStatuses.APPROVED}},
        {returnDocument: "after"}
      );

      const {statusCode, body} = await req
        .put(`/versioncontrol/sync/${testSync._id}`, {
          status: SyncStatuses.REJECTED
        })
        .catch(r => r);

      expect([statusCode, body.message]).toEqual([
        400,
        expect.stringContaining("Only syncs with PENDING status can be updated")
      ]);
    });

    it("should return 400 when trying to set invalid status", async () => {
      const [response1, response2] = await Promise.all([
        req
          .put(`/versioncontrol/sync/${testSync._id}`, {
            status: SyncStatuses.SUCCEEDED
          })
          .catch(r => r),
        req
          .put(`/versioncontrol/sync/${testSync._id}`, {
            status: SyncStatuses.FAILED
          })
          .catch(r => r)
      ]);

      expect(response1.statusCode).toBe(400);
      expect(response1.body).toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("Invalid status"),
        error: expect.any(String)
      });

      expect(response2.statusCode).toBe(400);
      expect(response2.body).toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("Invalid status"),
        error: expect.any(String)
      });
    });
  });
});
