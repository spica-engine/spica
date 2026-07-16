import {EventQueue} from "@spica-server/function-queue";
import {event} from "@spica-server/function-queue-proto";
import {ChangeEnqueuer} from "@spica-server/bucket-hooks/src/enqueuer";
import {ChangeEmitter} from "@spica-server/bucket-hooks/src/emitter";
import {ChangeQueue} from "@spica-server/bucket-hooks/src/queue";

const targetKey = (target: event.Target) =>
  JSON.stringify({id: target.id, cwd: target.cwd, handler: target.handler});

describe("ChangeEnqueuer", () => {
  let changeEnqeuer: ChangeEnqueuer;
  let noopTarget: event.Target;
  let noopTarget2: event.Target;
  let eventQueue: jest.Mocked<EventQueue>;
  let changeEmitter: jest.Mocked<ChangeEmitter>;

  beforeEach(() => {
    eventQueue = {
      enqueue: jest.fn()
    } as unknown as jest.Mocked<EventQueue>;
    changeEmitter = {
      on: jest.fn(),
      off: jest.fn()
    } as unknown as jest.Mocked<ChangeEmitter>;

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

  it("should add target to the changeTargets and call the 'on' method of emitter", () => {
    changeEnqeuer.subscribe(noopTarget, {
      bucket: "test_collection",
      type: "INSERT"
    });

    expect(changeEnqeuer["changeTargets"].get(targetKey(noopTarget)).options).toEqual({
      bucket: "test_collection",
      type: "INSERT"
    });

    expect(changeEmitter.on).toHaveBeenCalledTimes(1);

    expect(changeEmitter.on.mock.calls[0][0]).toEqual("test_collection_insert");
  });

  it("should remove the target from changeTargets and call the 'of' method of emitter", () => {
    changeEnqeuer.subscribe(noopTarget, {
      bucket: "test_collection",
      type: "INSERT"
    });

    changeEnqeuer.subscribe(noopTarget2, {
      bucket: "test_collection",
      type: "GET"
    });

    changeEnqeuer.unsubscribe(noopTarget);

    expect(changeEnqeuer["changeTargets"].get(targetKey(noopTarget))).toEqual(undefined);
    expect(changeEnqeuer["changeTargets"].get(targetKey(noopTarget2)).options).toEqual({
      bucket: "test_collection",
      type: "GET"
    });

    expect(changeEmitter.off).toHaveBeenCalledTimes(1);

    expect(changeEmitter.off.mock.calls[0][0]).toEqual("test_collection_insert");
  });

  describe("onChangeHandler", () => {
    let changeQueue: jest.Mocked<ChangeQueue>;

    beforeEach(() => {
      changeQueue = {
        enqueue: jest.fn()
      } as unknown as jest.Mocked<ChangeQueue>;

      changeEnqeuer = new ChangeEnqueuer(eventQueue, changeQueue, changeEmitter);
    });

    const rawChange = {type: "insert", documentKey: "doc1", previous: undefined, current: {a: 1}};

    it("should keep enqueueing after the scheduler attaches a context to the target", () => {
      changeEnqeuer.subscribe(noopTarget, {bucket: "test_collection", type: "INSERT"});

      changeEnqeuer.onChangeHandler(rawChange, noopTarget);

      noopTarget.context = new event.SchedulingContext({env: [], timeout: 60});

      expect(() => changeEnqeuer.onChangeHandler(rawChange, noopTarget)).not.toThrow();
      expect(eventQueue.enqueue).toHaveBeenCalledTimes(2);
      expect(changeQueue.enqueue.mock.calls[1][1].bucket).toEqual("test_collection");
    });

    it("should resolve a target rebuilt from a drained event", () => {
      changeEnqeuer.subscribe(noopTarget, {bucket: "test_collection", type: "INSERT"});

      const rebuilt = new event.Target({
        id: noopTarget.id,
        cwd: noopTarget.cwd,
        handler: noopTarget.handler,
        context: new event.SchedulingContext({env: [], timeout: 60})
      });

      changeEnqeuer.onChangeHandler(rawChange, rebuilt);

      expect(eventQueue.enqueue).toHaveBeenCalledTimes(1);
    });
  });
});
