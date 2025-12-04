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
        expect(received).toEqual(change);
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
          expect(received).toContainEqual({
            ...insertChange,
            // notice the type change here
            type: ChangeType.UPDATE
          });
          // unrelated change should be untouched
          expect(received).toContainEqual(unrelatedChange);
          done();
        },
        error: err => done.fail(err)
      });
    processor.push(insertChange);
    processor.push(deleteChange);
    processor.push(unrelatedChange);
  });
});
