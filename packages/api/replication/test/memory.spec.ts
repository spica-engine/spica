import {Test, TestingModule} from "@nestjs/testing";
import {
  DatabaseService,
  DatabaseTestingModule,
  ObjectId,
  probeWatch,
  WatchProbe
} from "@spica-server/database-testing";
import {CommandMemory, CommandService} from "@spica-server/replication";
import {
  COMMAND_MEMORY_OPTIONS,
  REPLICATION_SERVICE_OPTIONS
} from "@spica-server/interface-replication";

describe("Memory", () => {
  describe("Command", () => {
    let module: TestingModule;
    let memory: CommandMemory;
    let probe: WatchProbe;
    let subscription: {unsubscribe(): void} | undefined;

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

      /**
       * the neutral probe. The old `stream` shim patched `Db.prototype`, so it worked on MongoDB only
       * — on the PG leg `stream.wait()` returned `undefined` and the spec blew up on `.then`.
       *
       * `CommandMemory` is **constructed by hand, not taken from Nest**. The probe wraps
       * `database.collection` and `MongoMemory`'s constructor calls `watch()` immediately, while Nest
       * creates its providers during `compile()` — so by the time `module.get(CommandMemory)` is called,
       * `watch()` has already run and the wrapping cannot catch it. Constructing it by hand makes the
       * order explicit — what the spec tests is pub/sub behaviour, not Nest's wiring.
       */
      const db = module.get(DatabaseService);
      probe = probeWatch(db);

      memory = new CommandMemory(new CommandService(db, {expireAfterSeconds: 60}), {
        changeType: ["insert"]
      });
    });

    /**
     * The subscription is dropped too, not only the module. `MongoMemory` opens its change stream in the
     * constructor and `module.close()` knows nothing about the RxJS subscription, so a discarded one keeps
     * polling after the spec file ends — and fails with `interrupted at shutdown` when the next file's
     * cleanup stops the server, which jest then blames on **that** file. The same class as the leaked
     * subscriptions in `api/function/enqueuer`.
     */
    afterEach(async () => {
      subscription?.unsubscribe();
      subscription = undefined;
      await module.close();
    });

    it("should publish command on insert", done => {
      const command = {
        handler: "doSomething",
        class: "Class1",
        args: []
      };
      subscription = memory.subscribe({
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

      probe.wait().then(() =>
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
