import {EventQueue} from "@spica-server/function/queue";
import {Event} from "@spica-server/function/queue/proto";
import {ActionEnqueuer, ActionDispatcher} from "@spica-server/bucket/hooks";
import {Action} from "../../proto";

describe("enqueuer", () => {
  let actionEnqueuer: ActionEnqueuer;
  let noopTarget: Event.Target;
  let noopTarget2: Event.Target;
  let eventQueue: jasmine.SpyObj<EventQueue>;
  let dispatch: jasmine.SpyObj<ActionDispatcher>;

  beforeEach(() => {
    eventQueue = jasmine.createSpyObj("eventQueue", ["enqueue"]);
    dispatch = jasmine.createSpyObj("dispatch", ["on"]);

    actionEnqueuer = new ActionEnqueuer(eventQueue, null, dispatch);

    noopTarget = new Event.Target();
    noopTarget.cwd = "/tmp/fn1";
    noopTarget.handler = "default";

    noopTarget2 = new Event.Target();
    noopTarget2.cwd = "/tmp/fn2";
    noopTarget2.handler = "default";
  });

  afterEach(() => {
    eventQueue.enqueue.calls.reset();
  });

  it("should map headers", () => {
    const headers: Action.Header[] = actionEnqueuer.mapHeaders({
      authorization: "APIKEY 12345",
      strategy: "APIKEY"
    });

    expect([headers[0].key, headers[0].value]).toEqual(["authorization", "APIKEY 12345"]);
    expect([headers[1].key, headers[1].value]).toEqual(["strategy", "APIKEY"]);
  });

  it("should add action to targets", () => {
    actionEnqueuer.subscribe(noopTarget, {
      bucket: "test_collection",
      type: "INSERT"
    });

    expect(actionEnqueuer["targets"].get(noopTarget)).toEqual({
      bucket: "test_collection",
      type: "INSERT"
    });

    expect(dispatch.on).toHaveBeenCalledTimes(1);

    expect(dispatch.on.calls.first().args[0]).toEqual("test_collection_INSERT");
  });

  it("should unsubscribe from action", () => {
    actionEnqueuer["targets"].set(noopTarget, {bucket: "test_collection", type: "INSERT"});
    actionEnqueuer["targets"].set(noopTarget2, {bucket: "test_collection", type: "GET"});

    actionEnqueuer.unsubscribe(noopTarget);

    expect(actionEnqueuer["targets"].get(noopTarget)).toEqual(undefined);
    expect(actionEnqueuer["targets"].get(noopTarget2)).toEqual({
      bucket: "test_collection",
      type: "GET"
    });
  });
});
