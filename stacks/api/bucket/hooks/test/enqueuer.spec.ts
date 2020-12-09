import {EventQueue} from "@spica-server/function/queue";
import {event} from "@spica-server/function/queue/proto";
import {ChangeAndReviewEnqueuer} from "@spica-server/bucket/hooks/src/enqueuer";
import {ReviewDispatcher} from "@spica-server/bucket/hooks/src/dispatcher";
import {ChangeEmitter} from "@spica-server/bucket/hooks/src/emitter";

describe("ChangeAndReviewEnqueuer", () => {
  let changeOrReviewEnqeuer: ChangeAndReviewEnqueuer;
  let noopTarget: event.Target;
  let noopTarget2: event.Target;
  let eventQueue: jasmine.SpyObj<EventQueue>;
  let reviewDispatcher: jasmine.SpyObj<ReviewDispatcher>;
  let changeEmitter: jasmine.SpyObj<ChangeEmitter>;

  beforeEach(() => {
    eventQueue = jasmine.createSpyObj("eventQueue", ["enqueue"]);
    reviewDispatcher = jasmine.createSpyObj("dispatch", ["on", "off"]);
    changeEmitter = jasmine.createSpyObj("dispatch", ["on", "off"]);

    changeOrReviewEnqeuer = new ChangeAndReviewEnqueuer(
      eventQueue,
      null,
      reviewDispatcher,
      changeEmitter
    );

    noopTarget = new event.Target({
      cwd: "/tmp/fn1",
      handler: "default"
    });

    noopTarget2 = new event.Target({
      cwd: "/tmp/fn2",
      handler: "default"
    });
  });

  it("should add action to targets", () => {
    changeOrReviewEnqeuer.subscribe(noopTarget, {
      bucket: "test_collection",
      type: "INSERT",
      phase: "BEFORE"
    });

    expect(changeOrReviewEnqeuer["reviewTargets"].get(noopTarget).options).toEqual({
      bucket: "test_collection",
      phase: "BEFORE",
      type: "INSERT"
    });

    expect(reviewDispatcher.on).toHaveBeenCalledTimes(1);

    expect(reviewDispatcher.on.calls.first().args[0]).toEqual("test_collection_insert");
  });

  it("should unsubscribe", () => {
    changeOrReviewEnqeuer.subscribe(noopTarget, {
      bucket: "test_collection",
      type: "INSERT",
      phase: "BEFORE"
    });
    changeOrReviewEnqeuer.subscribe(noopTarget2, {
      bucket: "test_collection",
      type: "GET",
      phase: "BEFORE"
    });

    changeOrReviewEnqeuer.unsubscribe(noopTarget);

    expect(changeOrReviewEnqeuer["reviewTargets"].get(noopTarget)).toEqual(undefined);
    expect(changeOrReviewEnqeuer["reviewTargets"].get(noopTarget2).options).toEqual({
      bucket: "test_collection",
      phase: "BEFORE",
      type: "GET"
    });

    expect(reviewDispatcher.off).toHaveBeenCalledTimes(1);

    expect(reviewDispatcher.off.calls.first().args[0]).toEqual("test_collection_insert");
  });
});
