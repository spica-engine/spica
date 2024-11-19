import {DatabaseQueue, EventQueue, FirehoseQueue, HttpQueue} from "@spica/api/src/function/queue";
import {Database, event, Firehose, Http} from "@spica/api/src/function/queue/proto";
import {Compilation, Language} from "@spica/api/src/function/compiler";
import {Javascript} from "@spica/api/src/function/compiler/javascript";
import {Typescript} from "@spica/api/src/function/compiler/typescript";
import {Node} from "@spica/api/src/function/runtime/node";
import {FunctionTestBed} from "@spica/api/src/function/runtime/testing";
import * as os from "os";
import {PassThrough, Writable} from "stream";

process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:24075";
process.env.DISABLE_LOGGER = "true";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000;

describe("Entrypoint", () => {
  let queue: EventQueue;

  let runtime: Node;
  let language: Language;
  let enqueueSpy: jasmine.Spy;
  let popSpy: jasmine.Spy;
  let compilation: Compilation = {
    cwd: undefined,
    entrypoint: undefined
  };
  let id = 0;

  let queueSize = 0;

  function initializeFn(index: string) {
    compilation.entrypoint = `index.${language.description.extension}`;
    compilation.cwd = FunctionTestBed.initialize(index, compilation.entrypoint);
    return language.compile(compilation);
  }

  function spawn(stdout?: Writable, idOverride?: string): any {
    const worker = runtime.spawn({
      id: idOverride != undefined ? idOverride : String(++id),
      env: {
        __INTERNAL__SPICA__MONGOURL__: process.env.DATABASE_URI,
        __INTERNAL__SPICA__MONGODBNAME__: process.env.DATABASE_NAME,
        __INTERNAL__SPICA__MONGOREPL__: process.env.REPLICA_SET
      }
    });

    const stream = stdout || new PassThrough();

    worker.attach(stream, stream);

    return new Promise((resolve, reject) => {
      worker.once("error", e => {
        reject(e);
      });

      worker.once("exit", code => {
        if (code == 0) {
          resolve(code);
        } else {
          reject(code);
        }
      });
    });
  }

  beforeEach(async () => {
    let schedule;
    let event;

    function process() {
      if (schedule && event) {
        queueSize--;
        schedule(event);
        schedule = event = undefined;
      }
    }

    popSpy = jasmine.createSpy("pop").and.callFake((_, sc) => {
      schedule = sc;
      process();
    });

    enqueueSpy = jasmine.createSpy("enqueue").and.callFake(e => {
      queueSize++;
      event = e;
      process();
    });

    queue = new EventQueue(popSpy, enqueueSpy, () => {}, () => {});
    await queue.listen();
    runtime = new Node();
    language = new Javascript();
  });

  afterEach(() => {
    queue["kill"]();
  });

  it("should pop the latest event from queue", async done => {
    await initializeFn(`export default function() {}`);

    spawn();

    queue["_complete"] = () => {
      expect(queueSize).toBe(0);
      done();
    };

    queue.enqueue(
      new event.Event({
        type: -1,
        target: new event.Target({
          handler: "default",
          cwd: compilation.cwd,
          context: new event.SchedulingContext({
            env: [],
            timeout: 60
          })
        })
      })
    );
  });

  it("should exit abnormally when worker id was not set", async () => {
    const stream = new PassThrough();
    const writeSpy = spyOn(stream, "write").and.callThrough();
    expect(await spawn(stream, "").catch(e => e)).toBe(126);
    expect(writeSpy.calls.allArgs().map(args => args[0].toString())).toEqual([
      "Environment variable WORKER_ID was not set.\n"
    ]);
  });

  it("should exit abnormally when grpc address was not set", async () => {
    const address = process.env.FUNCTION_GRPC_ADDRESS;
    delete process.env.FUNCTION_GRPC_ADDRESS;

    const stream = new PassThrough();
    const writeSpy = spyOn(stream, "write").and.callThrough();
    expect(await spawn(stream, "").catch(e => e)).toBe(126);
    expect(writeSpy.calls.allArgs().map(args => args[0].toString())).toEqual([
      "Environment variable FUNCTION_GRPC_ADDRESS was not set.\n"
    ]);

    process.env.FUNCTION_GRPC_ADDRESS = address;
  });

  it("should exit abnormally if it can not find the exported handler", async () => {
    await initializeFn(`export const exists = ''`);

    const ev = new event.Event({
      type: -1,
      target: new event.Target({
        cwd: compilation.cwd,
        handler: "shouldhaveexisted",
        context: new event.SchedulingContext({
          env: [],
          timeout: 60
        })
      })
    });
    queue.enqueue(ev);

    const stream = new PassThrough();
    const writeSpy = spyOn(stream, "write").and.callThrough();

    await expectAsync(spawn(stream)).toBeRejectedWith(126);
    expect(writeSpy.calls.allArgs().map(args => args[0].toString())).toEqual([
      "This function does not export any symbol named 'shouldhaveexisted'.\n"
    ]);
  });

  it("should exit abnormally if the exported symbol is not a function", async () => {
    await initializeFn(`export const notafunction = ''`);

    const ev = new event.Event({
      type: -1,
      target: new event.Target({
        cwd: compilation.cwd,
        handler: "notafunction",
        context: new event.SchedulingContext({
          env: [],
          timeout: 60
        })
      })
    });
    queue.enqueue(ev);

    const stream = new PassThrough();
    const writeSpy = spyOn(stream, "write").and.callThrough();

    await expectAsync(spawn(stream)).toBeRejectedWith(126);
    expect(writeSpy.calls.allArgs().map(args => args[0].toString())).toEqual([
      "This function does export a symbol named 'notafunction' but it is not a function.\n"
    ]);
  });

  it("should redirect output to stream", async done => {
    await initializeFn(`export default function() {
      console.log('this should appear in the logs');
      console.warn('this also should appear in the logs');
    }`);

    const stream = new PassThrough();

    const writeSpy = spyOn(stream, "write").and.callThrough();

    spawn(stream);

    queue["_complete"] = () => {
      expect(writeSpy).toHaveBeenCalledTimes(2);
      expect(writeSpy.calls.allArgs().map(args => args[0].toString())).toEqual([
        "this should appear in the logs\n",
        "this also should appear in the logs\n"
      ]);
      done();
    };

    queue.enqueue(
      new event.Event({
        type: -1,
        target: new event.Target({
          cwd: compilation.cwd,
          handler: "default",
          context: new event.SchedulingContext({
            env: [],
            timeout: 60
          })
        })
      })
    );
  });

  it("should be able access to prebuilt env variables", async () => {
    process.env.DATABASE_URI = "mongodb://test";
    process.env.DATABASE_NAME = "testingdb";
    process.env.REPLICA_SET = "repl";
    process.env.HOME = os.homedir();
    await initializeFn(`
    export default function() {
      const {
        ENTRYPOINT,
        HOME,
        RUNTIME,
        __INTERNAL__SPICA__MONGOURL__: url,
        __INTERNAL__SPICA__MONGODBNAME__: dbName,
        __INTERNAL__SPICA__MONGOREPL__: repl
      } = process.env;
      if (
        ENTRYPOINT == "index" &&
        HOME &&
        RUNTIME == "node" &&
        url == "mongodb://test" &&
        dbName == "testingdb" &&
        repl == "repl"
      ) {
        process.exit(4);
      }
    }`);

    const ev = new event.Event({
      type: -1,
      target: new event.Target({
        cwd: compilation.cwd,
        handler: "default",
        context: new event.SchedulingContext({
          env: [],
          timeout: 60
        })
      })
    });
    queue.enqueue(ev);

    const exitCode = await spawn().catch(e => e);
    expect(exitCode).toBe(4);
  });

  it("should set env variables from scheduling context", async () => {
    await initializeFn(`
    export function env() {
      if (process.env.SET_FROM_CTX == "true" && process.env.TIMEOUT == "60") {
        process.exit(4);
      }
    }`);

    const ev = new event.Event({
      type: -1,
      target: new event.Target({
        cwd: compilation.cwd,
        handler: "env",
        context: new event.SchedulingContext({
          env: [new event.SchedulingContext.Env({key: "SET_FROM_CTX", value: "true"})],
          timeout: 60
        })
      })
    });
    queue.enqueue(ev);

    const exitCode = await spawn().catch(e => e);
    expect(exitCode).toBe(4);
  });

  describe("cjs interop", () => {
    beforeEach(() => {
      language = new Typescript();
    });

    it("should work with default handler", async () => {
      await initializeFn(`
      declare var process;
      export default function() {
        process.exit(4);
      }`);
      queue.enqueue(
        new event.Event({
          type: -1,
          target: new event.Target({
            handler: "default",
            cwd: compilation.cwd,
            context: new event.SchedulingContext({
              env: [],
              timeout: 60
            })
          })
        })
      );
      const exitCode = await spawn().catch(e => e);
      expect(exitCode).toBe(4);
    });

    it("should work with custom handler", async () => {
      await initializeFn(`
      declare var process;
      export function test() {
        process.exit(4);
      }`);
      queue.enqueue(
        new event.Event({
          type: -1,
          target: new event.Target({
            handler: "test",
            cwd: compilation.cwd,
            context: new event.SchedulingContext({
              env: [],
              timeout: 60
            })
          })
        })
      );
      const exitCode = await spawn().catch(e => e);
      expect(exitCode).toBe(4);
    });
  });

  describe("http", () => {
    let httpQueue: HttpQueue;

    beforeEach(() => {
      queue.drain();
      httpQueue = new HttpQueue();
      queue.addQueue(httpQueue);
      queue.listen();
    });

    it("should pop from the queue", async done => {
      await initializeFn(`export default function() {}`);

      const ev = new event.Event({
        type: event.Type.HTTP,
        target: new event.Target({
          cwd: compilation.cwd,
          handler: "default",
          context: new event.SchedulingContext({
            env: [],
            timeout: 60
          })
        })
      });
      queue.enqueue(ev);

      const request = new Http.Request();
      httpQueue.enqueue(ev.id, request, undefined);

      expect(httpQueue.size).toBe(1);
      expect(queueSize).toBe(1);

      queue["_complete"] = () => {
        // It gets deleted after the response is completed
        expect(httpQueue.size).toBe(0);
        expect(queueSize).toBe(0);
        done();
      };

      spawn();
    });

    it("should pass request to fn", async () => {
      await initializeFn(`
      export default function(req) {
        if ( req.headers.get('content-type') == 'application/json' ) {
          process.exit(4);
        }
      }`);

      const ev = new event.Event({
        type: event.Type.HTTP,
        target: new event.Target({
          cwd: compilation.cwd,
          handler: "default",
          context: new event.SchedulingContext({
            env: [],
            timeout: 60
          })
        })
      });

      queue.enqueue(ev);

      const request = new Http.Request({
        headers: [new Http.Header({key: "content-type", value: "application/json"})]
      });
      httpQueue.enqueue(ev.id, request, undefined);

      const exitCode = await spawn().catch(e => e);
      expect(exitCode).toBe(4);
    });

    it("should pass response to fn", async () => {
      await initializeFn(`
      export default function(req, res) {
        if ( res ) {
          process.exit(4);
        }
      }`);

      const ev = new event.Event({
        type: event.Type.HTTP,
        target: new event.Target({
          cwd: compilation.cwd,
          handler: "default",
          context: new event.SchedulingContext({
            env: [],
            timeout: 60
          })
        })
      });
      queue.enqueue(ev);

      const request = new Http.Request();
      httpQueue.enqueue(ev.id, request, undefined);

      const exitCode = await spawn().catch(e => e);

      expect(exitCode).toBe(4);
    });

    it("should send the response", async done => {
      await initializeFn(`export default function(req, res) {
        res.send({ oughtToSerialize: true  });
      }`);

      const ev = new event.Event({
        type: event.Type.HTTP,
        target: new event.Target({
          cwd: compilation.cwd,
          handler: "default",
          context: new event.SchedulingContext({
            env: [],
            timeout: 60
          })
        })
      });

      const serverResponse = {
        writeHead: jasmine.createSpy("writeHead"),
        end: jasmine.createSpy("end").and.callFake((_, __, callback) => {
          callback();
          expect(serverResponse.end).toHaveBeenCalledTimes(1);
          done();
        })
      };

      spawn();

      queue.enqueue(ev);
      httpQueue.enqueue(ev.id, new Http.Request(), serverResponse as any);
    });

    it("should send response for handler which contains unhandled promise rejection", async done => {
      await initializeFn(`export default function(req, res) {
        return Promise.reject("FAILED")
      }`);

      const ev = new event.Event({
        type: event.Type.HTTP,
        target: new event.Target({
          cwd: compilation.cwd,
          handler: "default",
          context: new event.SchedulingContext({
            env: [],
            timeout: 60
          })
        })
      });

      const serverResponse = {
        writeHead: jasmine.createSpy("writeHead"),
        end: jasmine.createSpy("end").and.callFake((_, __, callback) => {
          callback();
          expect(serverResponse.end).toHaveBeenCalledTimes(1);
          done();
        })
      };

      spawn(new PassThrough());

      queue.enqueue(ev);
      httpQueue.enqueue(ev.id, new Http.Request(), serverResponse as any);
    });

    it("should send the response from the returned value", async done => {
      await initializeFn(`export default function(req, res) {
        return {worksViaReturn: true};
      }`);

      const ev = new event.Event({
        type: event.Type.HTTP,
        target: new event.Target({
          cwd: compilation.cwd,
          handler: "default",
          context: new event.SchedulingContext({
            env: [],
            timeout: 60
          })
        })
      });

      const serverResponse = {
        writeHead: jasmine.createSpy("writeHead"),
        end: jasmine.createSpy("end").and.callFake((_, __, callback) => callback())
      };

      queue["_complete"] = () => {
        expect(serverResponse.end.calls.allArgs().map(args => args[0].toString())).toEqual([
          JSON.stringify({worksViaReturn: true})
        ]);
        done();
      };

      spawn();

      queue.enqueue(ev);
      httpQueue.enqueue(ev.id, new Http.Request(), serverResponse as any);
    });

    it("should not send the response from the returned value if the response has been sent already", async done => {
      await initializeFn(`export default function(req, res) {
        res.send({hasBeenSentViaSend: true});
        return {worksViaReturn: true};
      }`);

      const ev = new event.Event({
        type: event.Type.HTTP,
        target: new event.Target({
          cwd: compilation.cwd,
          handler: "default",
          context: new event.SchedulingContext({
            env: [],
            timeout: 60
          })
        })
      });

      const serverResponse = {
        writeHead: jasmine.createSpy("writeHead"),
        end: jasmine.createSpy("end").and.callFake((_, __, callback) => {
          callback();
          expect(serverResponse.end.calls.allArgs().map(args => args[0].toString())).toEqual([
            JSON.stringify({hasBeenSentViaSend: true})
          ]);
          done();
        })
      };

      spawn();

      queue.enqueue(ev);
      httpQueue.enqueue(ev.id, new Http.Request(), serverResponse as any);
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

    it("should pop from the queue", async done => {
      await initializeFn(`export default function() {}`);

      const ev = new event.Event({
        type: event.Type.DATABASE,
        target: new event.Target({
          cwd: compilation.cwd,
          handler: "default",
          context: new event.SchedulingContext({
            env: [],
            timeout: 60
          })
        })
      });

      queue["_complete"] = () => {
        expect(databaseQueue.size).toBe(0);
        done();
      };

      queue.enqueue(ev);

      const change = new Database.Change();
      databaseQueue.enqueue(ev.id, change);

      expect(databaseQueue.size).toBe(1);

      spawn();
    });

    it("should pass change to fn", async () => {
      await initializeFn(`
      export default function(change) {
        if ( change.kind == 'insert' && change.collection == 'test') {
          process.exit(4);
        }
      }`);
      const ev = new event.Event({
        type: event.Type.DATABASE,
        target: new event.Target({
          cwd: compilation.cwd,
          handler: "default",
          context: new event.SchedulingContext({
            env: [],
            timeout: 60
          })
        })
      });
      queue.enqueue(ev);

      const change = new Database.Change({
        kind: Database.Change.Kind.INSERT,
        collection: "test"
      });
      databaseQueue.enqueue(ev.id, change);

      const exitCode = await spawn().catch(e => e);

      expect(exitCode).toBe(4);
    });
  });

  describe("firehose", () => {
    let firehoseQueue: FirehoseQueue;

    beforeEach(() => {
      queue.drain();
      firehoseQueue = new FirehoseQueue();
      queue.addQueue(firehoseQueue);
      queue.listen();
    });

    it("pop from the queue", async () => {
      await initializeFn(`
      export default function({socket, pool}, message) {
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

      const ev = new event.Event({
        type: event.Type.FIREHOSE,
        target: new event.Target({
          cwd: compilation.cwd,
          handler: "default",
          context: new event.SchedulingContext({
            env: [],
            timeout: 60
          })
        })
      });
      queue.enqueue(ev);

      firehoseQueue.enqueue(
        ev.id,
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

      const exitCode = await spawn().catch(r => r);
      expect(exitCode).toBe(4, "Assertion failed.");
    });

    it("should send message to socket", async done => {
      await initializeFn(`export default function({socket, pool}, message) {
        socket.send('test', 'thisisthedata');
      }`);

      const ev = new event.Event({
        type: event.Type.FIREHOSE,
        target: new event.Target({
          cwd: compilation.cwd,
          handler: "default",
          context: new event.SchedulingContext({
            env: [],
            timeout: 60
          })
        })
      });

      queue["_complete"] = () => {
        expect(socketSpy.send).toHaveBeenCalledTimes(1);
        expect(socketSpy.send.calls.argsFor(0)[0]).toBe(`{"name":"test","data":"thisisthedata"}`);
        done();
      };

      queue.enqueue(ev);

      const socketSpy = jasmine.createSpyObj("Socket", ["send"]);
      socketSpy.readyState = 1;

      firehoseQueue.enqueue(
        ev.id,
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

      spawn();
    });

    it("should close the socket connection", async done => {
      await initializeFn(`export default function({socket, pool}, message) {
        socket.close();
      }`);

      const ev = new event.Event({
        type: event.Type.FIREHOSE,
        target: new event.Target({
          cwd: compilation.cwd,
          handler: "default",
          context: new event.SchedulingContext({
            env: [],
            timeout: 60
          })
        })
      });

      queue["_complete"] = () => {
        expect(socketSpy.close).toHaveBeenCalledTimes(1);
        done();
      };

      queue.enqueue(ev);

      const socketSpy = jasmine.createSpyObj("Socket", ["close"]);
      socketSpy.readyState = 1;

      firehoseQueue.enqueue(
        ev.id,
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

      spawn();
    });

    it("should send message to all sockets", async done => {
      await initializeFn(`export default function({socket, pool}, message) {
        pool.send('test', 'thisisthedata');
      }`);

      const ev = new event.Event({
        type: event.Type.FIREHOSE,
        target: new event.Target({
          cwd: compilation.cwd,
          handler: "default",
          context: new event.SchedulingContext({
            env: [],
            timeout: 60
          })
        })
      });

      queue["_complete"] = () => {
        expect(firstSocket.send).toHaveBeenCalledTimes(1);
        expect(firstSocket.send.calls.argsFor(0)[0]).toBe(`{"name":"test","data":"thisisthedata"}`);
        expect(secondSocket.send).toHaveBeenCalledTimes(1);
        expect(secondSocket.send.calls.argsFor(0)[0]).toBe(
          `{"name":"test","data":"thisisthedata"}`
        );
        done();
      };

      queue.enqueue(ev);

      const pool = new Firehose.PoolDescription({size: 21}),
        message = new Firehose.Message({name: "connection"});

      const firstSocket = jasmine.createSpyObj("firstSocket", ["send"]);
      firstSocket.readyState = 1; /* OPEN */

      firehoseQueue.enqueue(
        ev.id,
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
        ev.id,
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

      spawn();
    });
  });
});
