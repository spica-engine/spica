import {EventQueue} from "@spica-server/function/queue";
import {event} from "@spica-server/function/queue/proto";
import {ChangeEnqueuer} from "@spica-server/bucket/hooks/src/enqueuer";
import {ChangeEmitter} from "@spica-server/bucket/hooks/src/emitter";

describe("ChangeEnqueuer", () => {
  let changeEnqeuer: ChangeEnqueuer;
  let noopTarget: event.Target;
  let noopTarget2: event.Target;
  let eventQueue: jasmine.SpyObj<EventQueue>;
  let changeEmitter: jasmine.SpyObj<ChangeEmitter>;

  beforeEach(() => {
    eventQueue = jasmine.createSpyObj("eventQueue", ["enqueue"]);
    changeEmitter = jasmine.createSpyObj("dispatch", ["on", "off"]);

    changeEnqeuer = new ChangeEnqueuer(eventQueue, null, changeEmitter);

    noopTarget = new event.Target({
      cwd: "/tmp/fn1",
      handler: "default"
    });

    noopTarget2 = new event.Target({
      cwd: "/tmp/fn2",
      handler: "default"
    });
  });
});
