import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseTestingModule, ObjectId, stream} from "@spica-server/database-testing";
import {CommandMemory} from "@spica-server/replication";
import {provideRepository} from "@spica-server/data";
import {
  COMMAND_MEMORY_OPTIONS,
  COMMAND_REPOSITORY,
  REPLICATION_SERVICE_OPTIONS
} from "@spica-server/interface-replication";

describe("Memory", () => {
  describe("Command", () => {
    let module: TestingModule;
    let memory: CommandMemory;

    beforeEach(async () => {
      module = await Test.createTestingModule({
        imports: [DatabaseTestingModule.replicaSet()],
        providers: [
          {provide: COMMAND_MEMORY_OPTIONS, useValue: {changeType: ["insert"]}},
          {provide: REPLICATION_SERVICE_OPTIONS, useValue: {expireAfterSeconds: 60}},
          CommandMemory,
          provideRepository(COMMAND_REPOSITORY)
        ]
      }).compile();

      memory = module.get(CommandMemory);
    });

    afterEach(async () => await module.close());

    it("should publish command on insert", done => {
      const command = {
        handler: "doSomething",
        class: "Class1",
        args: []
      };
      memory.subscribe({
        next: msg => {
          expect(ObjectId.isValid(msg._id)).toEqual(true);
          expect(msg).toEqual({
            _id: msg._id,
            created_at: expect.any(Date),
            source: {
              id: "replica1",
              command
            },
            target: {
              commands: [command],
              id: "replica2"
            }
          });
          done();
        }
      });

      stream.wait().then(() =>
        memory.publish({
          source: {
            id: "replica1",
            command
          },
          target: {
            commands: [command],
            id: "replica2"
          }
        })
      );
    });
  });
});
