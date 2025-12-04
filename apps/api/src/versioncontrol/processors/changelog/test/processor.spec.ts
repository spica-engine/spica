import {Test} from "@nestjs/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {ChangeLog, ChangeOrigin, ChangeType} from "@spica-server/interface/versioncontrol";
import {
  ChangeLogProcessor,
  ChangeLogProcessorsModule
} from "@spica-server/versioncontrol/processors/changelog";
import {bufferCount} from "rxjs";

describe("ChangeLogProcessor", () => {
  let processor: ChangeLogProcessor;
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet(), ChangeLogProcessorsModule.forRoot()]
    }).compile();

    processor = module.get(ChangeLogProcessor);
  });

  it("should watch changes", done => {
    const change: ChangeLog = {
      created_at: new Date(),
      module: "test",
      sub_module: "subtest",
      origin: ChangeOrigin.DOCUMENT,
      type: ChangeType.CREATE,
      resource_content: "",
      resource_id: "id",
      resource_slug: "slug",
      resource_extension: ""
    };
    processor.watch().subscribe({
      next: received => {
        expect(received).toEqual({
          _id: received._id,
          created_at: change.created_at,
          module: change.module,
          sub_module: change.sub_module,
          origin: change.origin,
          type: change.type,
          resource_content: change.resource_content,
          resource_id: change.resource_id,
          resource_slug: change.resource_slug,
          resource_extension: change.resource_extension,
          synced_before: 1
        });
        done();
      },
      error: err => done.fail(err)
    });
    processor.push(change);
  });

  it("should emit insert+delete events as update", done => {
    const insertChange: ChangeLog = {
      created_at: new Date(),
      module: "test",
      sub_module: "subtest",
      origin: ChangeOrigin.REPRESENTATIVE,
      type: ChangeType.CREATE,
      resource_content: "",
      resource_id: "id",
      resource_slug: "slug2",
      resource_extension: ""
    };

    const deleteChange: ChangeLog = {
      created_at: new Date(),
      module: "test",
      sub_module: "subtest",
      origin: ChangeOrigin.REPRESENTATIVE,
      type: ChangeType.DELETE,
      resource_content: "",
      resource_id: "id",
      resource_slug: "slug",
      resource_extension: ""
    };

    const unrelatedChange: ChangeLog = {
      created_at: new Date(),
      module: "test",
      sub_module: "subtest",
      origin: ChangeOrigin.REPRESENTATIVE,
      type: ChangeType.UPDATE,
      resource_content: "",
      resource_id: "id",
      resource_slug: "slug",
      resource_extension: ""
    };

    processor
      .watch()
      .pipe(bufferCount(2))
      .subscribe({
        next: received => {
          expect(received.length).toBe(2);
          // First change: insertChange becomes UPDATE after aggregation with deleteChange
          expect(received[0]).toEqual({
            _id: received[0]._id,
            created_at: insertChange.created_at,
            module: insertChange.module,
            sub_module: insertChange.sub_module,
            origin: insertChange.origin,
            resource_content: insertChange.resource_content,
            resource_id: insertChange.resource_id,
            resource_slug: insertChange.resource_slug,
            resource_extension: insertChange.resource_extension,
            type: ChangeType.UPDATE,
            synced_before: 1
          });

          // Second change: unrelatedChange stays as is
          expect(received[1]).toEqual({
            _id: received[1]._id,
            created_at: unrelatedChange.created_at,
            module: unrelatedChange.module,
            sub_module: unrelatedChange.sub_module,
            origin: unrelatedChange.origin,
            resource_content: unrelatedChange.resource_content,
            resource_id: unrelatedChange.resource_id,
            resource_slug: unrelatedChange.resource_slug,
            resource_extension: unrelatedChange.resource_extension,
            type: unrelatedChange.type,
            synced_before: 1
          });
          done();
        },
        error: err => done.fail(err)
      });
    processor.push(insertChange);
    processor.push(deleteChange);
    processor.push(unrelatedChange);
  });

  it("should handle infinite sync", async () => {
    const change: ChangeLog = {
      created_at: new Date(),
      module: "test",
      sub_module: "subTest",
      origin: ChangeOrigin.DOCUMENT,
      type: ChangeType.CREATE,
      resource_content: "",
      resource_id: "123",
      resource_slug: "slug",
      resource_extension: ""
    };

    const sameChange: ChangeLog = {
      created_at: new Date(),
      module: "test",
      sub_module: "subTest",
      origin: ChangeOrigin.REPRESENTATIVE,
      type: ChangeType.CREATE,
      resource_content: "",
      resource_id: "123",
      resource_slug: "slug",
      resource_extension: ""
    };

    processor.watch().subscribe({
      next: received => {
        expect(received).toEqual({
          _id: received._id,
          created_at: change.created_at,
          module: change.module,
          sub_module: change.sub_module,
          origin: ChangeOrigin.DOCUMENT,
          type: ChangeType.CREATE,
          resource_content: change.resource_content,
          resource_id: change.resource_id,
          resource_slug: change.resource_slug,
          resource_extension: change.resource_extension,
          synced_before: 1
        });
      }
    });
    await processor.push(change);
    await processor.push(sameChange);
  });
});
