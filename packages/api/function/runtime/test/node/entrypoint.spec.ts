import {DatabaseQueue, EventQueue, FirehoseQueue, HttpQueue} from "@spica-server/function-queue";
import {Database, event, Firehose, Http} from "@spica-server/function-queue-proto";
import {Builder} from "@spica-server/function-builder";
import {BuildMeta} from "@spica-server/interface-function-builder";
import {LegacyBuilder} from "@spica-server/function-builder-legacy";
import {RollupBuilder} from "@spica-server/function-builder-rollup";
import {Node} from "@spica-server/function-scheduler";
import {FunctionTestBed} from "@spica-server/function/runtime/testing";
import fs from "fs";
import os from "os";
import path from "path";
import {PassThrough, Writable} from "stream";
import WebSocket from "ws";

process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:24075";
process.env.DISABLE_LOGGER = "true";

describe("Entrypoint", () => {
  let queue: EventQueue;

  let runtime: Node;
  let builder: Builder;
  let enqueueSpy: jest.Mock;
  let popSpy: jest.Mock;
  let meta: BuildMeta = {
    cwd: undefined,
    entrypoints: {build: undefined, runtime: undefined},
    outDir: ".build"
  };
  let id = 0;

  let queueSize = 0;

  let writeSpy: jest.SpyInstance;

  let stream: PassThrough;

  function initializeFn(index: string) {
    meta.entrypoints = builder.description.entrypoints;
    meta.cwd = FunctionTestBed.initialize(index, meta);
    return builder.build(meta);
  }

  function spawn(stdout?: Writable, idOverride?: string): any {
    const worker = runtime.spawn({
      id: idOverride != undefined ? idOverride : String(++id),
      env: {
        __INTERNAL__SPICA__MONGOURL__: process.env.DATABASE_URI,
        __INTERNAL__SPICA__MONGODBNAME__: process.env.DATABASE_NAME,
        __INTERNAL__SPICA__MONGOREPL__: process.env.REPLICA_SET
      },
      entrypointPath: process.env.FUNCTION_SPAWN_ENTRYPOINT_PATH
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

  function spawnWarm(stdout: Writable, warmEnv: {[key: string]: string}) {
    const worker = runtime.spawn({
      id: String(++id),
      env: {
        __INTERNAL__SPICA__MONGOURL__: process.env.DATABASE_URI,
        __INTERNAL__SPICA__MONGODBNAME__: process.env.DATABASE_NAME,
        __INTERNAL__SPICA__MONGOREPL__: process.env.REPLICA_SET,
        WARM: "true",
        WARM_CWD: meta.cwd,
        WARM_ENV: JSON.stringify(warmEnv)
      },
      entrypointPath: process.env.FUNCTION_SPAWN_ENTRYPOINT_PATH
    });

    worker.attach(stdout, stdout);

    return worker;
  }

  beforeEach(async () => {
    // Push model: the worker opens one subscribe stream, so the first callback hands us a
    // persistent `push` fn (kept across events, unlike the old one-shot pop `schedule`).
    let push;
    let event;

    function process() {
      if (push && event) {
        queueSize--;
        push(event);
        event = undefined;
      }
    }

    popSpy = jest.fn((_, p) => {
      push = p;
      process();
    });

    enqueueSpy = jest.fn(e => {
      queueSize++;
      event = e;
      process();
    });

    queue = new EventQueue(
      popSpy,
      enqueueSpy,
      () => {},
      () => {}
    );
    await queue.listen();
    runtime = new Node();
    builder = new LegacyBuilder("javascript");

    stream = new PassThrough();
    writeSpy = jest.spyOn(stream, "write");
  });

  afterEach(() => {
    writeSpy.mockClear();
    queueSize = 0;
    queue["kill"]();
  });

  it("should pop the latest event from queue", done => {
    initializeFn(`export default function() {}`).then(() => {
      spawn();

      queue["_complete"] = () => {
        expect(queueSize).toBe(0);
        done();
      };

      queue.enqueue(
        new event.Event({
          type: -1 as any,
          target: new event.Target({
            handler: "default",
            cwd: meta.cwd,
            context: new event.SchedulingContext({
              env: [],
              timeout: 60
            })
          })
        })
      );
    });
  });

  it("should preload the module top-level code during warm start before any event", async () => {
    // The module logs a sentinel at import time and reads an env var applied from
    // WARM_ENV. A cold worker only imports on an event; here no event is enqueued,
    // so seeing the sentinel proves the warm worker pre-loaded before blocking.
    await initializeFn(
      `console.log("PRELOADED::" + process.env.WARM_MARK); export default function() {}`
    );

    const out = new PassThrough();
    const preloaded = new Promise<void>(resolve => {
      let buf = "";
      out.on("data", d => {
        buf += d.toString();
        if (buf.includes("PRELOADED::hello")) {
          resolve();
        }
      });
    });

    const worker = spawnWarm(out, {WARM_MARK: "hello"});

    await preloaded;

    // the pre-loaded module is cache-warm, so an event still runs the handler and completes
    const completed = new Promise<void>(resolve => {
      queue["_complete"] = () => resolve();
    });

    queue.enqueue(
      new event.Event({
        type: -1 as any,
        target: new event.Target({
          handler: "default",
          cwd: meta.cwd,
          context: new event.SchedulingContext({env: [], timeout: 60})
        })
      })
    );

    await completed;
    await worker.kill();
  });

  it("should exit abnormally when worker id was not set", async () => {
    expect(await spawn(stream, "").catch(e => e)).toBe(126);
    expect(writeSpy.mock.calls.map(args => args[0].toString())).toEqual([
      "Environment variable WORKER_ID was not set.\n"
    ]);
  });

  it("should exit abnormally when grpc address was not set", async () => {
    const address = process.env.FUNCTION_GRPC_ADDRESS;
    delete process.env.FUNCTION_GRPC_ADDRESS;

    expect(await spawn(stream, "").catch(e => e)).toBe(126);
    expect(writeSpy.mock.calls.map(args => args[0].toString())).toEqual([
      "Environment variable FUNCTION_GRPC_ADDRESS was not set.\n"
    ]);

    process.env.FUNCTION_GRPC_ADDRESS = address;
  });

  it("should exit abnormally if it can not find the exported handler", async () => {
    await initializeFn(`export const exists = ''`);

    const ev = new event.Event({
      type: -1 as any,
      target: new event.Target({
        cwd: meta.cwd,
        handler: "shouldhaveexisted",
        context: new event.SchedulingContext({
          env: [],
          timeout: 60
        })
      })
    });
    queue.enqueue(ev);

    await expect(spawn(stream)).rejects.toEqual(126);
    expect(writeSpy.mock.calls.map(args => args[0].toString())).toEqual([
      "This function does not export any symbol named 'shouldhaveexisted'.\n"
    ]);
  });

  it("should exit abnormally if the exported symbol is not a function", async () => {
    await initializeFn(`export const notafunction = ''`);

    const ev = new event.Event({
      type: -1 as any,
      target: new event.Target({
        cwd: meta.cwd,
        handler: "notafunction",
        context: new event.SchedulingContext({
          env: [],
          timeout: 60
        })
      })
    });
    queue.enqueue(ev);

    await expect(spawn(stream)).rejects.toEqual(126);
    expect(writeSpy.mock.calls.map(args => args[0].toString())).toEqual([
      "This function does export a symbol named 'notafunction' but it is not a function.\n"
    ]);
  });

  it("should redirect output to stream", done => {
    initializeFn(`export default function() {
      console.log('this should appear in the logs');
      console.warn('this also should appear in the logs');
    }`).then(() => {
      spawn(stream);

      queue["_complete"] = () => {
        expect(writeSpy).toHaveBeenCalledTimes(2);
        expect(writeSpy.mock.calls.map(args => args[0].toString())).toEqual([
          "this should appear in the logs\n",
          "this also should appear in the logs\n"
        ]);
        done();
      };

      queue.enqueue(
        new event.Event({
          type: -1 as any,
          target: new event.Target({
            cwd: meta.cwd,
            handler: "default",
            context: new event.SchedulingContext({
              env: [],
              timeout: 60
            })
          })
        })
      );
    });
  });

  it("should be able access to prebuilt env variables", () => {
    process.env.DATABASE_URI = "mongodb://test";
    process.env.DATABASE_NAME = "testingdb";
    process.env.REPLICA_SET = "repl";
    process.env.HOME = os.homedir();
    initializeFn(`
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
    }`).then(() => {
      const ev = new event.Event({
        type: -1 as any,
        target: new event.Target({
          cwd: meta.cwd,
          handler: "default",
          context: new event.SchedulingContext({
            env: [],
            timeout: 60
          })
        })
      });
      queue.enqueue(ev);

      spawn()
        .then(exitCode => {
          expect(exitCode).toBe(4);
        })
        .catch(e => e);
    });
  });

  it("should set env variables from scheduling context", async () => {
    await initializeFn(`
    export function env() {
      if (process.env.SET_FROM_CTX == "true" && process.env.TIMEOUT == "60") {
        process.exit(4);
      }
    }`);

    const ev = new event.Event({
      type: -1 as any,
      target: new event.Target({
        cwd: meta.cwd,
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
      builder = new LegacyBuilder("typescript", {
        tsCompilerPath: process.env.FUNCTION_TS_COMPILER_PATH
      });
    });

    it("should work with default handler", async () => {
      await initializeFn(`
      declare var process;
      export default function() {
        process.exit(4);
      }`);
      queue.enqueue(
        new event.Event({
          type: -1 as any,
          target: new event.Target({
            handler: "default",
            cwd: meta.cwd,
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
          type: -1 as any,
          target: new event.Target({
            handler: "test",
            cwd: meta.cwd,
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

  describe("rollup bundle", () => {
    beforeEach(() => {
      builder = new RollupBuilder("typescript", {
        workerPath: process.env.FUNCTION_ROLLUP_WORKER_PATH
      });
    });

    afterEach(() => builder.kill());

    it("should run a function bundled together with its local imports", async () => {
      meta.entrypoints = builder.description.entrypoints;
      meta.cwd = FunctionTestBed.initialize(
        `import {exitCode} from "./codes.js";
        declare var process;
        export function test() {
          process.exit(exitCode);
        }`,
        meta
      );
      fs.writeFileSync(path.join(meta.cwd, "codes.ts"), `export const exitCode = 4;`);
      await builder.build(meta);

      queue.enqueue(
        new event.Event({
          type: -1 as any,
          target: new event.Target({
            handler: "test",
            cwd: meta.cwd,
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

    it("should pop from the queue", done => {
      initializeFn(`export default function() {}`).then(() => {
        const ev = new event.Event({
          type: event.Type.HTTP,
          target: new event.Target({
            cwd: meta.cwd,
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
          cwd: meta.cwd,
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
          cwd: meta.cwd,
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

    it("should send the response", done => {
      initializeFn(`export default function(req, res) {
        res.send({ oughtToSerialize: true  });
      }`).then(() => {
        const ev = new event.Event({
          type: event.Type.HTTP,
          target: new event.Target({
            cwd: meta.cwd,
            handler: "default",
            context: new event.SchedulingContext({
              env: [],
              timeout: 60
            })
          })
        });

        const serverResponse = {
          writeHead: jest.fn(),
          end: jest.fn((_, __, callback) => {
            callback();
            expect(serverResponse.end).toHaveBeenCalledTimes(1);
            done();
          })
        };

        spawn();

        queue.enqueue(ev);
        httpQueue.enqueue(ev.id, new Http.Request(), serverResponse as any);
      });
    });

    it("should send response for handler which contains unhandled promise rejection", done => {
      initializeFn(`export default function(req, res) {
        return Promise.reject("FAILED")
      }`).then(() => {
        const ev = new event.Event({
          type: event.Type.HTTP,
          target: new event.Target({
            cwd: meta.cwd,
            handler: "default",
            context: new event.SchedulingContext({
              env: [],
              timeout: 60
            })
          })
        });

        const serverResponse = {
          writeHead: jest.fn(),
          end: jest.fn((_, __, callback) => {
            callback();
            expect(serverResponse.end).toHaveBeenCalledTimes(1);
            done();
          })
        };

        spawn(new PassThrough());

        queue.enqueue(ev);
        httpQueue.enqueue(ev.id, new Http.Request(), serverResponse as any);
      });
    });

    it("should send the response from the returned value", done => {
      initializeFn(`export default function(req, res) {
        return {worksViaReturn: true};
      }`).then(() => {
        const ev = new event.Event({
          type: event.Type.HTTP,
          target: new event.Target({
            cwd: meta.cwd,
            handler: "default",
            context: new event.SchedulingContext({
              env: [],
              timeout: 60
            })
          })
        });

        const serverResponse = {
          writeHead: jest.fn(),
          end: jest.fn((_, __, callback) => callback())
        };

        queue["_complete"] = () => {
          expect(serverResponse.end.mock.calls.map(args => args[0].toString())).toEqual([
            JSON.stringify({worksViaReturn: true})
          ]);
          done();
        };

        spawn();

        queue.enqueue(ev);
        httpQueue.enqueue(ev.id, new Http.Request(), serverResponse as any);
      });
    });

    it("should not send the response from the returned value if the response has been sent already", done => {
      initializeFn(`export default function(req, res) {
        res.send({hasBeenSentViaSend: true});
        return {worksViaReturn: true};
      }`).then(() => {
        const ev = new event.Event({
          type: event.Type.HTTP,
          target: new event.Target({
            cwd: meta.cwd,
            handler: "default",
            context: new event.SchedulingContext({
              env: [],
              timeout: 60
            })
          })
        });

        const serverResponse = {
          writeHead: jest.fn(),
          end: jest.fn((_, __, callback) => {
            callback();
            expect(serverResponse.end.mock.calls.map(args => args[0].toString())).toEqual([
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
  });

  describe("database", () => {
    let databaseQueue: DatabaseQueue;

    beforeEach(() => {
      queue.drain();
      databaseQueue = new DatabaseQueue();
      queue.addQueue(databaseQueue);
      queue.listen();
    });

    it("should pop from the queue", done => {
      initializeFn(`export default function() {}`).then(() => {
        const ev = new event.Event({
          type: event.Type.DATABASE,
          target: new event.Target({
            cwd: meta.cwd,
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
          cwd: meta.cwd,
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
          cwd: meta.cwd,
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
        })
      );

      const exitCode = await spawn().catch(r => r);
      expect(exitCode).toBe(4);
    });

    it("should send message to socket", done => {
      initializeFn(`export default function({socket, pool}, message) {
        socket.send('test', 'thisisthedata');
      }`).then(() => {
        const ev = new event.Event({
          type: event.Type.FIREHOSE,
          target: new event.Target({
            cwd: meta.cwd,
            handler: "default",
            context: new event.SchedulingContext({
              env: [],
              timeout: 60
            })
          })
        });

        queue["_complete"] = () => {
          expect(socketSpy.send).toHaveBeenCalledTimes(1);
          expect(socketSpy.send.mock.calls[0][0]).toBe(`{"name":"test","data":"thisisthedata"}`);
          done();
        };

        queue.enqueue(ev);

        const socketSpy = {
          send: jest.fn(),
          readyState: 1
        };

        const msg = new Firehose.Message.Incoming({
          client: new Firehose.ClientDescription({
            id: "1",
            remoteAddress: "[::1]"
          }),
          message: new Firehose.Message({name: "connection"}),
          pool: new Firehose.PoolDescription({size: 21})
        });

        firehoseQueue.enqueue(ev.id, msg);
        firehoseQueue.setSocket(msg, socketSpy as unknown as WebSocket);

        spawn();
      });
    });

    it("should close the socket connection", done => {
      initializeFn(`export default function({socket, pool}, message) {
        socket.close();
      }`).then(() => {
        const ev = new event.Event({
          type: event.Type.FIREHOSE,
          target: new event.Target({
            cwd: meta.cwd,
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

        const socketSpy = {
          close: jest.fn(),
          readyState: 1
        };

        const msg = new Firehose.Message.Incoming({
          client: new Firehose.ClientDescription({
            id: "1",
            remoteAddress: "[::1]"
          }),
          message: new Firehose.Message({name: "connection"}),
          pool: new Firehose.PoolDescription({size: 21})
        });
        firehoseQueue.enqueue(ev.id, msg);
        firehoseQueue.setSocket(msg, socketSpy as unknown as WebSocket);

        spawn();
      });
    });

    it("should send message to all sockets", done => {
      initializeFn(`export default function({socket, pool}, message) {
        pool.send('test', 'thisisthedata');
      }`).then(() => {
        const ev = new event.Event({
          type: event.Type.FIREHOSE,
          target: new event.Target({
            cwd: meta.cwd,
            handler: "default",
            context: new event.SchedulingContext({
              env: [],
              timeout: 60
            })
          })
        });

        queue["_complete"] = () => {
          expect(firstSocket.send).toHaveBeenCalledTimes(1);
          expect(firstSocket.send.mock.calls[0][0]).toBe(`{"name":"test","data":"thisisthedata"}`);
          expect(secondSocket.send).toHaveBeenCalledTimes(1);
          expect(secondSocket.send.mock.calls[0][0]).toBe(`{"name":"test","data":"thisisthedata"}`);
          done();
        };

        queue.enqueue(ev);

        const pool = new Firehose.PoolDescription({size: 21}),
          message = new Firehose.Message({name: "connection"});

        const msg1 = new Firehose.Message.Incoming({
          client: new Firehose.ClientDescription({
            id: "1",
            remoteAddress: "[::1]"
          }),
          message,
          pool
        });

        const firstSocket = {
          send: jest.fn(),
          readyState: 1
        };
        firehoseQueue.enqueue(ev.id, msg1);
        firehoseQueue.setSocket(msg1, firstSocket as unknown as WebSocket);

        const msg2 = new Firehose.Message.Incoming({
          client: new Firehose.ClientDescription({
            id: "2",
            remoteAddress: "[::1]"
          }),
          message,
          pool
        });
        const secondSocket = {
          send: jest.fn(),
          readyState: 1
        };
        firehoseQueue.enqueue(ev.id, msg2);
        firehoseQueue.setSocket(msg2, secondSocket as unknown as WebSocket);

        spawn();
      });
    });
  });
});
