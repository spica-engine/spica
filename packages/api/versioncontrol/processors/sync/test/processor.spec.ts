import {Test} from "@nestjs/testing";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database-testing";
import {
  ApprovedSync,
  ChangeInitiator,
  ChangeOrigin,
  ChangeType,
  PendingSync,
  Sync,
  SyncStatuses
} from "@spica-server/interface-versioncontrol";
import {
  SyncProcessor,
  SyncProcessorsModule,
  VCConfigService
} from "@spica-server/versioncontrol/processors/sync";
import {bufferCount} from "rxjs";

function getMockSync(
  status: SyncStatuses = SyncStatuses.PENDING,
  overrides: Partial<Sync["change_log"]> = {}
): Sync {
  return {
    _id: new ObjectId(),
    change_log: {
      created_at: new Date(),
      module: "test",
      sub_module: "subtest",
      origin: ChangeOrigin.DOCUMENT,
      type: ChangeType.CREATE,
      resource_content: "",
      resource_id: "id",
      resource_slug: "slug",
      resource_extension: "",
      initiator: ChangeInitiator.EXTERNAL,
      event_id: "event-id",
      ...overrides
    },
    created_at: new Date(),
    status: status,
    updated_at: new Date()
  };
}

describe("SyncProcessor", () => {
  let processor: SyncProcessor;
  let vcConfigService: VCConfigService;
  let module;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet(), SyncProcessorsModule.forRoot()]
    }).compile();

    processor = module.get(SyncProcessor);
    vcConfigService = module.get(VCConfigService);
    await module.init();
  });

  afterEach(async () => {
    await module.close();
  });

  it("should emit all", done => {
    const pendingSync: PendingSync = getMockSync(SyncStatuses.PENDING) as PendingSync;

    const approvedSync: ApprovedSync = {
      ...pendingSync,
      status: SyncStatuses.APPROVED,
      _id: new ObjectId()
    };

    processor
      .watch()
      .pipe(bufferCount(2))
      .subscribe({
        next: received => {
          expect(received).toEqual([pendingSync, approvedSync]);
          done();
        },
        error: err => {
          done.fail(err);
        }
      });

    processor.push(pendingSync, approvedSync);
  });

  it("should emit approved syncs", done => {
    const pendingSync: PendingSync = getMockSync(SyncStatuses.PENDING) as PendingSync;

    const approvedSync: ApprovedSync = {
      ...pendingSync,
      status: SyncStatuses.APPROVED,
      _id: new ObjectId()
    };

    processor.watch(SyncStatuses.APPROVED).subscribe({
      next: received => {
        expect(received).toEqual(approvedSync);
        done();
      },
      error: err => {
        done.fail(err);
      }
    });

    processor.push(pendingSync, approvedSync);
  });

  it("should emit approved syncs when updated", done => {
    const pendingSync: PendingSync = getMockSync(SyncStatuses.PENDING) as PendingSync;

    processor.watch(SyncStatuses.APPROVED).subscribe({
      next: received => {
        expect(received).toEqual({
          ...pendingSync,
          status: SyncStatuses.APPROVED,
          updated_at: expect.any(Date)
        });
        expect(Number(received.updated_at)).toBeGreaterThan(Number(received.created_at));
        done();
      },
      error: err => {
        done.fail(err);
      }
    });

    processor
      .push(pendingSync)
      .then(() => processor.update(pendingSync._id, SyncStatuses.APPROVED));
  });

  it("should update sync on error", async () => {
    const sync: ApprovedSync = getMockSync(SyncStatuses.APPROVED) as ApprovedSync;

    await processor.push(sync);
    const updated = await processor.update(sync._id, SyncStatuses.FAILED, "Test reason");
    expect(updated).toEqual({
      ...sync,
      status: SyncStatuses.FAILED,
      reason: "Test reason",
      updated_at: expect.any(Date)
    });
    expect(Number(updated.updated_at)).toBeGreaterThan(Number(updated.created_at));
  });

  describe("auto approve", () => {
    it("should always auto-approve internal syncs regardless of config", async () => {
      const sync = getMockSync(SyncStatuses.PENDING, {
        initiator: ChangeInitiator.INTERNAL
      }) as PendingSync;

      const [result] = await processor.push(sync);
      expect(result.status).toBe(SyncStatuses.APPROVED);
    });

    it("should keep external document-origin sync as PENDING when config document is false", async () => {
      const sync = getMockSync(SyncStatuses.PENDING, {
        initiator: ChangeInitiator.EXTERNAL,
        origin: ChangeOrigin.DOCUMENT
      }) as PendingSync;

      const [result] = await processor.push(sync);
      expect(result.status).toBe(SyncStatuses.PENDING);
    });

    it("should auto-approve external document-origin sync when config document is true", async () => {
      await vcConfigService.set({
        autoApproveSync: {document: true, representative: false}
      });
      await new Promise(resolve => setTimeout(resolve, 500));

      const sync = getMockSync(SyncStatuses.PENDING, {
        initiator: ChangeInitiator.EXTERNAL,
        origin: ChangeOrigin.DOCUMENT
      }) as PendingSync;

      const [result] = await processor.push(sync);
      expect(result.status).toBe(SyncStatuses.APPROVED);
    });

    it("should keep external representative-origin sync as PENDING when config representative is false", async () => {
      const sync = getMockSync(SyncStatuses.PENDING, {
        initiator: ChangeInitiator.EXTERNAL,
        origin: ChangeOrigin.REPRESENTATIVE
      }) as PendingSync;

      const [result] = await processor.push(sync);
      expect(result.status).toBe(SyncStatuses.PENDING);
    });

    it("should auto-approve external representative-origin sync when config representative is true", async () => {
      await vcConfigService.set({
        autoApproveSync: {document: false, representative: true}
      });
      await new Promise(resolve => setTimeout(resolve, 500));

      const sync = getMockSync(SyncStatuses.PENDING, {
        initiator: ChangeInitiator.EXTERNAL,
        origin: ChangeOrigin.REPRESENTATIVE
      }) as PendingSync;

      const [result] = await processor.push(sync);
      expect(result.status).toBe(SyncStatuses.APPROVED);
    });

    it("should auto-approve both origins when both are enabled", async () => {
      await vcConfigService.set({
        autoApproveSync: {document: true, representative: true}
      });
      await new Promise(resolve => setTimeout(resolve, 500));

      const docSync = getMockSync(SyncStatuses.PENDING, {
        initiator: ChangeInitiator.EXTERNAL,
        origin: ChangeOrigin.DOCUMENT
      }) as PendingSync;

      const repSync = getMockSync(SyncStatuses.PENDING, {
        initiator: ChangeInitiator.EXTERNAL,
        origin: ChangeOrigin.REPRESENTATIVE
      }) as PendingSync;

      const results = await processor.push(docSync, repSync);
      expect(results[0].status).toBe(SyncStatuses.APPROVED);
      expect(results[1].status).toBe(SyncStatuses.APPROVED);
    });

    it("should not auto-approve external document sync when only representative is enabled", async () => {
      await vcConfigService.set({
        autoApproveSync: {document: false, representative: true}
      });
      await new Promise(resolve => setTimeout(resolve, 500));

      const sync = getMockSync(SyncStatuses.PENDING, {
        initiator: ChangeInitiator.EXTERNAL,
        origin: ChangeOrigin.DOCUMENT
      }) as PendingSync;

      const [result] = await processor.push(sync);
      expect(result.status).toBe(SyncStatuses.PENDING);
    });
  });
});
