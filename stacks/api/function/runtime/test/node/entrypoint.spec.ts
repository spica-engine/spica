import {DatabaseQueue, EventQueue, FirehoseQueue, HttpQueue} from "@spica-server/function/queue";
import {Database, Event, Firehose, Http} from "@spica-server/function/queue/proto";
import {Compilation} from "@spica-server/function/runtime";
import {Node} from "@spica-server/function/runtime/node";
import {FunctionTestBed} from "@spica-server/function/runtime/testing";
import {PassThrough} from "stream";

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
    queue["kill"]();
  });

  it("should pop the latest event from queue", async () => {
    await initializeFn(`export default function() {}`);

    const event = new Event.Event();
    event.target = new Event.Target();
    event.id = "1";
    event.type = -1 /* NO-OP */;
    event.target.cwd = compilation.cwd;
    event.target.handler = "default";

    queue.enqueue(event);
    expect(queue.size).toBe(1);

    await runtime.execute({
      cwd: compilation.cwd,
      eventId: event.id,
      stdout: "inherit"
    });
    expect(queue.size).toBe(0);
  });

  it("should should exit abnormally if it can not find the message", async () => {
    await initializeFn(`export default function() {}`);

    expect(
      await runtime
        .execute({
          cwd: compilation.cwd,
          eventId: "1",
          stdout: "inherit"
        })
        .catch(e => e)
    ).toBe(126);
  });

  it("should redirect output to stream", async () => {
    await initializeFn(`export default function() {
      console.log('this should appear in the logs');
      console.warn('this also should appear in the logs');
    }`);

    const event = new Event.Event();
    event.target = new Event.Target();
    event.id = "1";
    event.type = -1 /* NO-OP */;
    event.target.cwd = compilation.cwd;
    event.target.handler = "default";

    queue.enqueue(event);

    const stream = new PassThrough();

    const writeSpy = spyOn(stream, "write").and.callThrough();

    await runtime.execute({
      cwd: compilation.cwd,
      eventId: event.id,
      stdout: stream
    });

    expect(writeSpy).toHaveBeenCalledTimes(2);
    expect(writeSpy.calls.allArgs().map(args => args[0].toString())).toEqual([
      "this should appear in the logs\n",
      "this also should appear in the logs\n"
    ]);
  });

  describe("http", () => {
    let httpQueue: HttpQueue;

    beforeEach(() => {
      queue.drain();
      httpQueue = new HttpQueue();
      queue.addQueue(httpQueue);
      queue.listen();
    });

    it("should pop from the queue", async () => {
      await initializeFn(`export default function() {}`);

      const event = new Event.Event();
      event.type = Event.Type.HTTP;

      event.target = new Event.Target();
      event.target.cwd = compilation.cwd;
      event.target.handler = "default";

      queue.enqueue(event);

      const request = new Http.Request();
      httpQueue.enqueue(event.id, request, undefined);

      expect(httpQueue.size).toBe(1);
      expect(queue.size).toBe(1);

      await runtime.execute({
        eventId: event.id,
        cwd: event.target.cwd,
        stdout: "inherit"
      });

      // It gets deleted after the response is completed
      expect(httpQueue.size).toBe(0);
    });

    it("should pass request to fn", async () => {
      await initializeFn(`export default function(req) {
        if ( req.headers.get('content-type') == 'application/json' ) {
          process.exit(4);
        }
      }`);

      const event = new Event.Event();
      event.type = Event.Type.HTTP;
      event.target = new Event.Target();
      event.target.cwd = compilation.cwd;
      event.target.handler = "default";

      queue.enqueue(event);

      const request = new Http.Request();
      const header = new Http.Header();
      header.key = "content-type";
      header.value = "application/json";
      request.headers = [header];
      httpQueue.enqueue(event.id, request, undefined);

      const exitCode = await runtime
        .execute({
          eventId: event.id,
          cwd: event.target.cwd,
          stdout: "inherit"
        })
        .catch(e => e);

      expect(exitCode).toBe(4);
    });

    it("should pass response to fn", async () => {
      await initializeFn(`export default function(req, res) {
        if ( res ) {
          process.exit(4);
        }
      }`);

      const event = new Event.Event();
      event.type = Event.Type.HTTP;
      event.target = new Event.Target();
      event.target.cwd = compilation.cwd;
      event.target.handler = "default";

      queue.enqueue(event);

      const request = new Http.Request();
      httpQueue.enqueue(event.id, request, undefined);

      const exitCode = await runtime
        .execute({
          eventId: event.id,
          cwd: event.target.cwd,
          stdout: "inherit"
        })
        .catch(e => e);

      expect(exitCode).toBe(4);
    });

    it("should send the response", async () => {
      await initializeFn(`export default function(req, res) {
        res.send({ oughtToSerialize: true  })
      }`);

      const event = new Event.Event();
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
        cwd: event.target.cwd,
        stdout: "inherit"
      });

      expect(httpQueue.size).toBe(0);
      expect(serverResponse.writeHead).toHaveBeenCalledTimes(1);
      expect(serverResponse.end).toHaveBeenCalledTimes(1);
    });
  });

  describe("database", () => {
    let databaseQueue: DatabaseQueue;

    beforeEach(() => {
      queue.drain();
      databaseQueue = new DatabaseQueue();
      queue.addQueue(databaseQueue);
      queue.listen();
    });

    it("should pop from the queue", async () => {
      await initializeFn(`export default function() {}`);

      const event = new Event.Event();
      event.type = Event.Type.DATABASE;

      event.target = new Event.Target();
      event.target.cwd = compilation.cwd;
      event.target.handler = "default";

      queue.enqueue(event);

      const change = new Database.Change();

      databaseQueue.enqueue(event.id, change);

      expect(databaseQueue.size).toBe(1);

      await runtime.execute({
        eventId: event.id,
        cwd: event.target.cwd,
        stdout: "inherit"
      });

      expect(databaseQueue.size).toBe(0);
    });

    it("should pass change to fn", async () => {
      await initializeFn(`export default function(change) {
        console.log(change, change.kind);
        if ( change.kind == 'insert' && change.collection == 'test') {
          process.exit(4);
        }
      }`);

      const event = new Event.Event();
      event.type = Event.Type.DATABASE;

      event.target = new Event.Target();
      event.target.cwd = compilation.cwd;
      event.target.handler = "default";

      queue.enqueue(event);

      const change = new Database.Change();
      change.kind = Database.Change.Kind.INSERT;
      change.collection = "test";

      databaseQueue.enqueue(event.id, change);

      const exitCode = await runtime
        .execute({
          eventId: event.id,
          cwd: event.target.cwd,
          stdout: "inherit"
        })
        .catch(e => e);

      expect(exitCode).toBe(4);
    });
  });

  describe("Firehose", () => {
    let firehoseQueue: FirehoseQueue;

    beforeEach(() => {
      queue.drain();
      firehoseQueue = new FirehoseQueue();
      queue.addQueue(firehoseQueue);
      queue.listen();
    });

    it("pop from the queue", async () => {
      await initializeFn(`export default function({socket, pool}, message) {
        console.log(arguments);
        if ( 
          socket.remoteAddress == "[::1]" && 
          socket.id == "1" &&
          pool.size == 21 &&
          message.name == "test" && 
          message.data == "test"
        ) {
          process.exit(4);
        }
      }`);

      const event = new Event.Event();
      event.type = Event.Type.FIREHOSE;

      event.target = new Event.Target();
      event.target.cwd = compilation.cwd;
      event.target.handler = "default";

      queue.enqueue(event);

      firehoseQueue.enqueue(
        event.id,
        new Firehose.Message.Incoming({
          client: new Firehose.ClientDescription({
            id: "1",
            remoteAddress: "[::1]"
          }),
          message: new Firehose.Message({name: "test", data: JSON.stringify("test")}),
          pool: new Firehose.PoolDescription({size: 21})
        }),
        undefined
      );

      const exitCode = await runtime
        .execute({
          eventId: event.id,
          cwd: event.target.cwd,
          stdout: "inherit"
        })
        .catch(r => r);
      expect(exitCode).toBe(4, "Assertion failed.");
    });

    it("should send message to socket", async () => {
      await initializeFn(`export default function({socket, pool}, message) {
        socket.send('test', 'thisisthedata');
      }`);

      const event = new Event.Event();
      event.type = Event.Type.FIREHOSE;

      event.target = new Event.Target();
      event.target.cwd = compilation.cwd;
      event.target.handler = "default";

      queue.enqueue(event);

      const socketSpy = jasmine.createSpyObj("Socket", ["send"]);

      firehoseQueue.enqueue(
        event.id,
        new Firehose.Message.Incoming({
          client: new Firehose.ClientDescription({
            id: "1",
            remoteAddress: "[::1]"
          }),
          message: new Firehose.Message({name: "connection"}),
          pool: new Firehose.PoolDescription({size: 21})
        }),
        socketSpy
      );

      await runtime.execute({
        eventId: event.id,
        cwd: event.target.cwd,
        stdout: "inherit"
      });
      expect(socketSpy.send).toHaveBeenCalledTimes(1);
      expect(socketSpy.send.calls.argsFor(0)[0]).toBe(`{"name":"test","data":"thisisthedata"}`);
    });

    it("should close the socket connection", async () => {
      await initializeFn(`export default function({socket, pool}, message) {
        socket.close();
      }`);

      const event = new Event.Event();
      event.type = Event.Type.FIREHOSE;

      event.target = new Event.Target();
      event.target.cwd = compilation.cwd;
      event.target.handler = "default";

      queue.enqueue(event);

      const socketSpy = jasmine.createSpyObj("Socket", ["close"]);
      socketSpy.readyState = 1;

      firehoseQueue.enqueue(
        event.id,
        new Firehose.Message.Incoming({
          client: new Firehose.ClientDescription({
            id: "1",
            remoteAddress: "[::1]"
          }),
          message: new Firehose.Message({name: "connection"}),
          pool: new Firehose.PoolDescription({size: 21})
        }),
        socketSpy
      );

      await runtime.execute({
        eventId: event.id,
        cwd: event.target.cwd,
        stdout: "inherit"
      });
      expect(socketSpy.close).toHaveBeenCalledTimes(1);
    });

    it("should send message to all sockets", async () => {
      await initializeFn(`export default function({socket, pool}, message) {
        pool.send('test', 'thisisthedata');
      }`);

      const event = new Event.Event();
      event.type = Event.Type.FIREHOSE;

      event.target = new Event.Target();
      event.target.cwd = compilation.cwd;
      event.target.handler = "default";

      queue.enqueue(event);

      const pool = new Firehose.PoolDescription({size: 21}),
        message = new Firehose.Message({name: "connection"});

      const firstSocket = jasmine.createSpyObj("firstSocket", ["send"]);
      firstSocket.readyState = 1; /* OPEN */

      firehoseQueue.enqueue(
        event.id,
        new Firehose.Message.Incoming({
          client: new Firehose.ClientDescription({
            id: "1",
            remoteAddress: "[::1]"
          }),
          message,
          pool
        }),
        firstSocket
      );

      const secondSocket = jasmine.createSpyObj("secondSocket", ["send"]);
      secondSocket.readyState = 1; /* OPEN */

      firehoseQueue.enqueue(
        event.id,
        new Firehose.Message.Incoming({
          client: new Firehose.ClientDescription({
            id: "2",
            remoteAddress: "[::1]"
          }),
          message,
          pool
        }),
        secondSocket
      );

      await runtime.execute({
        eventId: event.id,
        cwd: event.target.cwd,
        stdout: "inherit"
      });
      expect(firstSocket.send).toHaveBeenCalledTimes(1);
      expect(firstSocket.send.calls.argsFor(0)[0]).toBe(`{"name":"test","data":"thisisthedata"}`);
      expect(secondSocket.send).toHaveBeenCalledTimes(1);
      expect(secondSocket.send.calls.argsFor(0)[0]).toBe(`{"name":"test","data":"thisisthedata"}`);
    });
  });
});
