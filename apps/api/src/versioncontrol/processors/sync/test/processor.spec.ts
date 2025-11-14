import {Test} from "@nestjs/testing";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {ChangeOrigin, ChangeType, Sync, SyncStatuses} from "@spica-server/interface/versioncontrol";
import {SyncProcessor, SyncProcessorsModule} from "@spica-server/versioncontrol/processors/sync";
import {ApprovedSync, PendingSync} from "../src/interface";
import {bufferCount} from "rxjs";

function getMockSync(status: SyncStatuses = SyncStatuses.PENDING): Sync {
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
      resource_extension: ""
    },
    created_at: new Date(),
    status: status,
    updated_at: new Date()
  };
}

describe("SyncProcessor", () => {
  let processor: SyncProcessor;
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet(), SyncProcessorsModule.forRoot()]
    }).compile();

    processor = module.get(SyncProcessor);
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
});
