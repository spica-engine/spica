import {EventQueue} from "../../../function/queue";
import {event} from "../../../function/queue/proto";
import {ChangeEnqueuer} from "../src/enqueuer";
import {ChangeEmitter} from "../src/emitter";

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

    expect(
      changeEnqeuer["changeTargets"].get(JSON.stringify(noopTarget.toObject())).options
    ).toEqual({
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

    expect(changeEnqeuer["changeTargets"].get(JSON.stringify(noopTarget.toObject()))).toEqual(
      undefined
    );
    expect(
      changeEnqeuer["changeTargets"].get(JSON.stringify(noopTarget2.toObject())).options
    ).toEqual({
      bucket: "test_collection",
      type: "GET"
    });

    expect(changeEmitter.off).toHaveBeenCalledTimes(1);

    expect(changeEmitter.off.mock.calls[0][0]).toEqual("test_collection_insert");
  });
});
