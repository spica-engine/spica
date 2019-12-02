import {EventQueue, HttpQueue} from "@spica-server/function/queue";
import {Event, Http} from "@spica-server/function/queue/proto";
import {Compilation} from "@spica-server/function/runtime";
import {Node} from "@spica-server/function/runtime/node";
import {FunctionTestBed} from "@spica-server/function/runtime/testing";
describe("Entrypoint", () => {
  let queue: EventQueue;
  let runtime: Node;
  let enqueueSpy: jasmine.Spy;
  let compilation: Compilation = {
    cwd: undefined,
    entrypoint: "index.ts"
  };

  function initializeFn(index: string) {
    compilation.cwd = FunctionTestBed.initialize(index);
    return runtime.compile(compilation);
  }

  beforeEach(() => {
    enqueueSpy = jasmine.createSpy("enqueue");
    queue = new EventQueue(enqueueSpy);
    queue.listen();
    runtime = new Node();
  });

  afterEach(() => {
    queue.kill();
  });

  it("should pop the latest event from queue", async () => {
    await initializeFn(`export default function() {}`);

    const event = new Event.Event();
    event.target = new Event.Target();
    event.id = "1";
    event.type = Event.Type.HTTP;
    event.target.cwd = compilation.cwd;
    event.target.handler = "default";

    queue.enqueue(event);
    expect(queue.size).toBe(1);

    await runtime.execute({
      cwd: compilation.cwd,
      eventId: event.id
    });
    expect(queue.size).toBe(0);
  });

  it("should should exit abnormally if the queue is empty", async () => {
    await initializeFn(`export default function() {}`);

    expect(
      await runtime
        .execute({
          cwd: compilation.cwd,
          eventId: undefined
        })
        .catch(e => e)
    ).toBe(126);
  });

  describe("http", () => {
    let httpQueue: HttpQueue;
    beforeEach(() => {
      httpQueue = new HttpQueue();
      queue.addQueue(httpQueue);
    });

    
  });
});
