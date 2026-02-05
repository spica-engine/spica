import {Test} from "@nestjs/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {
  ChangeInitiator,
  ChangeLog,
  ChangeOrigin,
  ChangeType
} from "@spica-server/interface/versioncontrol";
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

  it("should watch changes for insert", done => {
    const change: ChangeLog = {
      created_at: new Date(),
      module: "test",
      sub_module: "subtest",
      origin: ChangeOrigin.DOCUMENT,
      type: ChangeType.CREATE,
      resource_content: "",
      resource_id: "id",
      resource_slug: "slug",
      resource_extension: "",
      initiator: ChangeInitiator.EXTERNAL
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
          initiator: change.initiator
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
      resource_id: "id1",
      resource_slug: "slug2",
      resource_extension: "",
      initiator: ChangeInitiator.EXTERNAL
    };

    const deleteChange: ChangeLog = {
      created_at: new Date(),
      module: "test",
      sub_module: "subtest",
      origin: ChangeOrigin.REPRESENTATIVE,
      type: ChangeType.DELETE,
      resource_content: "",
      resource_id: "id1",
      resource_slug: "slug2",
      resource_extension: "",
      initiator: ChangeInitiator.EXTERNAL
    };

    const unrelatedChange: ChangeLog = {
      created_at: new Date(),
      module: "test",
      sub_module: "subtest",
      origin: ChangeOrigin.REPRESENTATIVE,
      type: ChangeType.UPDATE,
      resource_content: "",
      resource_id: "id2",
      resource_slug: "slug",
      resource_extension: "",
      initiator: ChangeInitiator.EXTERNAL
    };

    processor
      .watch()
      .pipe(bufferCount(2))
      .subscribe({
        next: received => {
          expect(received.length).toBe(2);
          const updateChange = received.find(change => change.resource_id === "id1");

          expect(updateChange._id).toBeDefined();
          delete updateChange._id;

          expect(updateChange).toEqual({
            _id: updateChange._id,
            created_at: updateChange.created_at,
            module: updateChange.module,
            sub_module: updateChange.sub_module,
            origin: updateChange.origin,
            resource_content: updateChange.resource_content,
            resource_id: updateChange.resource_id,
            resource_slug: updateChange.resource_slug,
            resource_extension: updateChange.resource_extension,
            // notice here
            type: ChangeType.UPDATE,
            initiator: updateChange.initiator
          });

          const unrelatedChange = received.find(change => change.resource_id === "id2");

          expect(unrelatedChange._id).toBeDefined();
          delete unrelatedChange._id;
          // Second change: unrelatedChange stays as is
          expect(unrelatedChange).toEqual({
            _id: unrelatedChange._id,
            created_at: unrelatedChange.created_at,
            module: unrelatedChange.module,
            sub_module: unrelatedChange.sub_module,
            origin: unrelatedChange.origin,
            resource_content: unrelatedChange.resource_content,
            resource_id: unrelatedChange.resource_id,
            resource_slug: unrelatedChange.resource_slug,
            resource_extension: unrelatedChange.resource_extension,
            type: unrelatedChange.type,
            initiator: unrelatedChange.initiator
          });
          done();
        },
        error: err => done.fail(err)
      });
    processor.push(insertChange);
    processor.push(deleteChange);
    processor.push(unrelatedChange);
  });

  it("should prevent infinite sync", async () => {
    const firstChange: ChangeLog = {
      created_at: new Date(),
      module: "test",
      sub_module: "subTest",
      origin: ChangeOrigin.DOCUMENT,
      type: ChangeType.CREATE,
      resource_content: "",
      resource_id: "123",
      resource_slug: "slug",
      resource_extension: "",
      initiator: ChangeInitiator.EXTERNAL
    };

    const reflectedChange: ChangeLog = {
      created_at: new Date(),
      module: "test",
      sub_module: "subTest",
      origin: ChangeOrigin.REPRESENTATIVE,
      type: ChangeType.CREATE,
      resource_content: "",
      resource_id: "123",
      resource_slug: "slug",
      resource_extension: "",
      initiator: ChangeInitiator.EXTERNAL
    };

    const secondChange: ChangeLog = {
      created_at: new Date(),
      module: "test",
      sub_module: "subTest",
      origin: ChangeOrigin.REPRESENTATIVE,
      type: ChangeType.CREATE,
      resource_content: "",
      resource_id: "123",
      resource_slug: "slug",
      resource_extension: "",
      initiator: ChangeInitiator.EXTERNAL
    };

    const firstPush = await processor.push(firstChange);
    expect(firstPush).toEqual(firstChange);

    const reflectedPush = await processor.push(reflectedChange);
    expect(reflectedPush).toBeUndefined();

    // allow further pushes
    const secondPush = await processor.push(secondChange);
    expect(secondPush).toEqual(secondChange);
  });
});
