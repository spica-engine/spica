import {SystemEnqueuer} from "@spica/api/src/function/enqueuer";
import {EventQueue} from "@spica/api/src/function/queue";
import {event} from "@spica/api/src/function/queue/proto";

function createTarget(cwd?: string, handler?: string) {
  const target = new event.Target();
  target.cwd = cwd || "/tmp/fn1";
  target.handler = handler || "default";
  return target;
}

describe("SystemEnqueuer", () => {
  const noopTarget = createTarget();
  let enqueuer: SystemEnqueuer;
  let eventQueue: jasmine.SpyObj<EventQueue>;
  let nextSpy: jasmine.Spy;
  let invokerSpy: jasmine.Spy;

  const clock = jasmine.clock();

  beforeAll(() => clock.install());
  afterAll(() => clock.uninstall());

  beforeEach(() => {
    eventQueue = {
      enqueue: jasmine.createSpy("enqueue")
    } as jasmine.SpyObj<EventQueue>;
    enqueuer = new SystemEnqueuer(eventQueue);
    nextSpy = spyOn(enqueuer["subscriptionSubject"], "next").and.callThrough();
    invokerSpy = spyOn(enqueuer, "invokeReadyEventTargets" as never).and.callThrough();
  });

  it("should subscribe", () => {
    enqueuer.subscribe(noopTarget, {name: "READY"});

    const targets: event.Target[] = Array.from(enqueuer["readyTargets"]);
    expect(targets.length).toEqual(1);

    expect([targets[0].cwd, targets[0].handler]).toEqual(["/tmp/fn1", "default"]);
  });

  it("should unsubscribe", () => {
    const target1 = createTarget("/tmp/fn1", "handler1");
    const target2 = createTarget("/tmp/fn1", "handler2");
    const target3 = createTarget("/tmp/fn2", "handler1");

    enqueuer.subscribe(target1, {name: "READY"});
    enqueuer.subscribe(target2, {name: "READY"});
    enqueuer.subscribe(target3, {name: "READY"});

    enqueuer.unsubscribe(target1);

    const targets: event.Target[] = Array.from(enqueuer["readyTargets"]);
    expect(targets.length).toEqual(2);

    expect(targets.map(t => [t.cwd, t.handler])).toEqual([
      ["/tmp/fn1", "handler2"],
      ["/tmp/fn2", "handler1"]
    ]);
  });

  it("should not call next till first subscribe is received", () => {
    expect(invokerSpy).not.toHaveBeenCalled();

    enqueuer.subscribe(noopTarget, {name: "READY"});

    expect(nextSpy).toHaveBeenCalledTimes(1);
    expect(nextSpy).toHaveBeenCalledWith(noopTarget);
    expect(invokerSpy).not.toHaveBeenCalled();

    clock.tick(1500);

    expect(invokerSpy).toHaveBeenCalledTimes(1);
    expect(eventQueue.enqueue).toHaveBeenCalledTimes(1);
    const [ev] = eventQueue.enqueue.calls.argsFor(0);
    expect(ev.target).toBe(noopTarget);
    expect(ev.type).toBe(event.Type.SYSTEM);
  });

  it("should debounce the calls to subscribe method", () => {
    expect(invokerSpy).not.toHaveBeenCalled();

    enqueuer.subscribe(noopTarget, {name: "READY"});
    clock.tick(500);
    expect(invokerSpy).not.toHaveBeenCalled();

    enqueuer.subscribe(noopTarget, {name: "READY"});
    clock.tick(500);
    expect(invokerSpy).not.toHaveBeenCalled();

    clock.tick(1500);

    expect(invokerSpy).toHaveBeenCalledTimes(1);
  });

  it("should not invoke the functions after it had already executed", () => {
    expect(invokerSpy).not.toHaveBeenCalled();

    enqueuer.subscribe(noopTarget, {name: "READY"});
    clock.tick(1500);
    expect(invokerSpy).toHaveBeenCalledTimes(1);

    enqueuer.subscribe(noopTarget, {name: "READY"});
    clock.tick(500);
    enqueuer.subscribe(noopTarget, {name: "READY"});
    clock.tick(500);

    clock.tick(1500);
    expect(invokerSpy).toHaveBeenCalledTimes(1);
  });

  it("should not invoke the functions which has unsubscribed while debouncing", () => {
    expect(invokerSpy).not.toHaveBeenCalled();

    enqueuer.subscribe(noopTarget, {name: "READY"});
    expect(nextSpy).toHaveBeenCalledWith(noopTarget);
    clock.tick(500);

    enqueuer.unsubscribe(noopTarget);
    clock.tick(1500);

    expect(invokerSpy).toHaveBeenCalledTimes(1);
    expect(eventQueue.enqueue).not.toHaveBeenCalled();
  });
});
