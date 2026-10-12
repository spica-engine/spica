import {Test, TestingModule} from "@nestjs/testing";
import {CommandMessenger} from "@spica-server/replication";
import {CommandMessage, Command} from "@spica-server/interface-replication";
import {ReplicationTestingModule} from "@spica-server/replication/testing";

function wait(ms) {
  return Promise.resolve((resolve, _) => resolve(ms));
}

describe("Command Messenger", () => {
  let module1: TestingModule;
  let module2: TestingModule;

  let api1Messenger: CommandMessenger;
  let api2Messenger: CommandMessenger;
  const subscriptions: {unsubscribe(): void}[] = [];

  let cmd: Command;

  let msg: CommandMessage;

  function compileModule() {
    return Test.createTestingModule({
      imports: [ReplicationTestingModule.create()]
    }).compile();
  }

  beforeEach(async () => {
    cmd = {
      class: "MockClass",
      handler: "mockFn",
      args: []
    };

    msg = {
      source: {
        command: cmd
      },
      target: {
        commands: [cmd]
      }
    };

    module1 = await compileModule();
    api1Messenger = module1.get(CommandMessenger);

    module2 = await compileModule();
    api2Messenger = module2.get(CommandMessenger);
  });

  /**
   * The subscriptions are dropped too, not only the modules. `CommandMessenger` opens its change stream in
   * the constructor and `module.close()` knows nothing about the RxJS subscription, so a discarded one keeps
   * polling after the spec file ends — and fails with `interrupted at shutdown` when the next file's cleanup
   * stops the server, which jest then blames on **that** file.
   */
  afterEach(async () => {
    subscriptions.forEach(subscription => subscription.unsubscribe());
    subscriptions.length = 0;
    await module1.close();
    await module2.close();
  });

  it("should publish message", done => {
    const api1Observer = jest.fn();

    subscriptions.push(
      api1Messenger.subscribe({
        next: api1Observer
      })
    );

    subscriptions.push(
      api2Messenger.subscribe({
        next: received => {
          expect(received.source.id).toEqual(api1Messenger.replicaId);
          msg.source.id = received.source.id;
          expect(received).toEqual(msg);

          wait(1000);

          expect(api1Observer).not.toHaveBeenCalled();

          done();
        }
      })
    );

    api1Messenger.publish(msg);
  });
});
