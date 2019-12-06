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

  // it("should pop the latest event from queue", async () => {
  //   await initializeFn(`export default function() {}`);

  //   const event = new Event.Event();
  //   event.target = new Event.Target();
  //   event.id = "1";
  //   event.type = -1 /* NO-OP */;
  //   event.target.cwd = compilation.cwd;
  //   event.target.handler = "default";

  //   queue.enqueue(event);
  //   expect(queue.size).toBe(1);

  //   await runtime.execute({
  //     cwd: compilation.cwd,
  //     eventId: event.id
  //   });
  //   expect(queue.size).toBe(0);
  // });

  // it("should should exit abnormally if the queue is empty", async () => {
  //   await initializeFn(`export default function() {}`);

  //   expect(
  //     await runtime
  //       .execute({
  //         cwd: compilation.cwd,
  //         eventId: undefined
  //       })
  //       .catch(e => e)
  //   ).toBe(126);
  // });

  describe("http", () => {
    let httpQueue: HttpQueue;

    beforeEach(() => {
      queue.drain();
      httpQueue = new HttpQueue();
      queue.addQueue(httpQueue);
      queue.listen();
    });

    // it("should pop from http queue", async () => {
    //   await initializeFn(`export default function() {}`);

    //   const event = new Event.Event();
    //   event.id = "2";
    //   event.type = Event.Type.HTTP;
    //   event.target = new Event.Target();
    //   event.target.cwd = compilation.cwd;
    //   event.target.handler = "default";

    //   queue.enqueue(event);

    //   const request = new Http.Request();
    //   httpQueue.enqueue(event.id, request, undefined);

    //   expect(httpQueue.size).toBe(1);
    //   expect(queue.size).toBe(1);

    //   await runtime.execute({
    //     eventId: event.id,
    //     cwd: event.target.cwd
    //   });

    //   // It gets deleted after the response is completed
    //   expect(httpQueue.size).toBe(0);
    // });

    // it("should pass request to fn", async () => {
    //   await initializeFn(`export default function(req) {
    //     console.log(JSON.stringify(req.headers));
    //     if ( req.headers.get('content-type') == 'application/json' ) {
    //       process.exit(4);
    //     }
    //   }`);

    //   const event = new Event.Event();
    //   event.id = "3";
    //   event.type = Event.Type.HTTP;
    //   event.target = new Event.Target();
    //   event.target.cwd = compilation.cwd;
    //   event.target.handler = "default";

    //   queue.enqueue(event);

    //   const request = new Http.Request();
    //   const header = new Http.Header();
    //   header.key = "content-type";
    //   header.value = "application/json";
    //   request.headers = [header];
    //   httpQueue.enqueue(event.id, request, undefined);

    //   const exitCode = await runtime
    //     .execute({
    //       eventId: event.id,
    //       cwd: event.target.cwd
    //     })
    //     .catch(e => e);

    //   expect(exitCode).toBe(4);
    // });

    // it("should pass response to fn", async () => {
    //   await initializeFn(`export default function(req, res) {
    //     if ( res ) {
    //       process.exit(4);
    //     }
    //   }`);

    //   const event = new Event.Event();
    //   event.id = "4";
    //   event.type = Event.Type.HTTP;
    //   event.target = new Event.Target();
    //   event.target.cwd = compilation.cwd;
    //   event.target.handler = "default";

    //   queue.enqueue(event);

    //   const request = new Http.Request();
    //   httpQueue.enqueue(event.id, request, undefined);

    //   const exitCode = await runtime
    //     .execute({
    //       eventId: event.id,
    //       cwd: event.target.cwd
    //     })
    //     .catch(e => e);

    //   expect(exitCode).toBe(4);
    // });

    it("should send the response", async () => {
      console.log("\n\n\n\n\n\n");
      await initializeFn(`export default function(req, res) {
        res.send({ oughtToSerialize: true  })
      }`);

      const event = new Event.Event();
      event.id = "5";
      event.type = Event.Type.HTTP;
      event.target = new Event.Target();
      event.target.cwd = compilation.cwd;
      event.target.handler = "default";

      queue.enqueue(event);

      const request = new Http.Request();
      const serverResponse: any = {
        writeHead: jasmine.createSpy("writeHead"),
        write: jasmine.createSpy("write"),
        end: jasmine.createSpy("end").and.callFake((_, __, callback) => callback())
      };
      httpQueue.enqueue(event.id, request, serverResponse);

      expect(httpQueue.size).toBe(1);
      expect(queue.size).toBe(1);

      await runtime.execute({
        eventId: event.id,
        cwd: event.target.cwd
      });

      expect(httpQueue.size).toBe(0);
      expect(serverResponse.writeHead).toHaveBeenCalledTimes(1);
      expect(serverResponse.end).toHaveBeenCalledTimes(1);
    });
  });
});
