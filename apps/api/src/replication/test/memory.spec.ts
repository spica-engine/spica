import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseTestingModule, ObjectId, stream} from "@spica-server/database/testing";
import {
  CommandMemory,
  CommandService,
  COMMAND_MEMORY_OPTIONS,
  REPLICATION_SERVICE_OPTIONS
} from "@spica-server/replication";

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
          CommandService
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
