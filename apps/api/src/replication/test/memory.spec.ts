import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseTestingModule, stream} from "@spica/database";
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

      jasmine.addCustomEqualityTester((actual, expected) => {
        if (expected == "__skip__" && !!actual) {
          return true;
        }
      });
    });

    afterEach(async () => await module.close());

    it("should publish command on insert", async done => {
      const command = {
        handler: "doSomething",
        class: "Class1",
        args: []
      };
      memory.subscribe({
        next: msg => {
          expect(msg).toEqual({
            _id: "__skip__",
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

      await stream.wait();
      await memory.publish({
        source: {
          id: "replica1",
          command
        },
        target: {
          commands: [command],
          id: "replica2"
        }
      });
    });
  });
});
