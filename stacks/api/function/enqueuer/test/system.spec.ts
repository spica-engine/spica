import {SystemEnqueuer} from "@spica-server/function/enqueuer";
import {EventQueue} from "@spica-server/function/queue";
import {Event} from "@spica-server/function/queue/proto";

describe("SystemEnqueuer", () => {
  const noopTarget = new Event.Target({cwd: "/tmp/fn1", handler: "default"});
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

  it("should not call next till first subscribe is received", () => {
    expect(invokerSpy).not.toHaveBeenCalled();

    enqueuer.subscribe(noopTarget, {name: "READY"});

    expect(nextSpy).toHaveBeenCalledTimes(1);
    expect(nextSpy).toHaveBeenCalledWith(noopTarget);
    expect(invokerSpy).not.toHaveBeenCalled();

    clock.tick(1500);

    expect(invokerSpy).toHaveBeenCalledTimes(1);
    expect(eventQueue.enqueue).toHaveBeenCalledTimes(1);
    const [event] = eventQueue.enqueue.calls.argsFor(0);
    expect(event.target).toBe(noopTarget);
    expect(event.type).toBe(Event.Type.SYSTEM);
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
