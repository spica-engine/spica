import {
  ChangeQueue as BucketChangeQueue,
  Change as BucketChange
} from "@spica-server/bucket-hooks-proto-node";
import {hooks as BucketHooks} from "@spica-server/bucket-hooks-proto";

import {
  Change,
  DatabaseQueue,
  EventQueue,
  FirehosePool,
  FirehoseQueue,
  FirehoseSocket,
  HttpQueue,
  Message,
  Request,
  Response,
  RabbitMQQueue,
  RabbitMQMessage,
  RabbitMQChannel,
  GrpcQueue as GrpcQueueNode
} from "@spica-server/function-queue-node";

import {
  Database,
  event,
  Firehose,
  Http,
  RabbitMQ,
  Grpc as GrpcProto
} from "@spica-server/function-queue-proto";

import {createRequire} from "module";
import * as path from "path";

import {getLoggerConsole, logContext} from "@spica-server/function-runtime-logger";

if (process.env.LOGGER) {
  console = getLoggerConsole();
}

if (!process.env.FUNCTION_GRPC_ADDRESS) {
  exitAbnormally("Environment variable FUNCTION_GRPC_ADDRESS was not set.");
}

if (!process.env.ENTRYPOINT) {
  exitAbnormally("Environment variable ENTRYPOINT was not set.");
}

if (!process.env.WORKER_ID) {
  exitAbnormally("Environment variable WORKER_ID was not set.");
}

(async () => {
  const queue = new EventQueue();
  const pop = new event.Pop({
    id: process.env.WORKER_ID
  });
  await initialize();

  if (process.env.WARM) {
    await preload();
  }

  await run(queue, pop);
})();

// One long-lived subscribe stream carries every event the scheduler assigns to this
// worker. The scheduler bounds how many are in flight (per-function concurrency), so we
// simply run each arriving event without a self-imposed limit — concurrently, since the
// handler is fire-and-forget on this single event loop. Each runs inside a logContext
// carrying its event id so concurrent events' logs stay demultiplexable.
function run(queue: EventQueue, pop: event.Pop) {
  return new Promise<void>((resolve, reject) => {
    const stream = queue.subscribe(pop);
    stream.on("data", (ev: event.Event) => {
      logContext.run({eventId: ev.id}, () => _process(ev, queue)).catch(e => console.error(e));
    });
    stream.on("end", () => resolve());
    stream.on("error", (e: any) => {
      // A cancelled stream on shutdown (code 1) is the normal teardown path.
      if (e && e.code == 1) {
        resolve();
      } else {
        reject(e);
      }
    });
  });
}

async function initialize() {
  if (process.env.__EXPERIMENTAL_DEVKIT_DATABASE_CACHE) {
    const _require = globalThis.require;
    globalThis.require = createRequire(path.join(process.cwd(), "external/npm/node_modules"));
    await import("./experimental_database.js");
    globalThis.require = _require;
  }
}

/*
  Warm start: run everything a cold worker would only do lazily inside _process
  (chdir, env, module import) BEFORE the worker blocks on its first event. The
  import() executes the user module's top-level imports and global assignments and
  populates Node's ES module cache, so _process' own import() (same resolved path)
  is a cache hit and only the handler invocation remains on the event's critical path.
  On failure we swallow the error and fall through to the normal cold path so the
  error surfaces per-event exactly as it does today.
*/
async function preload() {
  try {
    const env = JSON.parse(process.env.WARM_ENV || "{}");
    for (const key of Object.keys(env)) {
      process.env[key] = env[key];
    }

    process.chdir(process.env.WARM_CWD!);

    globalThis.require = createRequire(path.join(process.cwd(), "node_modules"));

    await import(path.join(process.cwd(), ".build", process.env.ENTRYPOINT!));
  } catch (e) {
    console.error(e);
  }
}

let workerContextInitialized = false;

function initializeWorkerContext(ev: event.Event) {
  if (workerContextInitialized) {
    return;
  }
  // A worker is pinned to a single function for its lifetime (the scheduler only
  // routes same-target events to it, and env/secret changes outdate it), so cwd
  // and env are constant. Set them once instead of on every event — mutating
  // these process globals per event would race across concurrent lanes.
  process.chdir(ev.target.cwd);
  process.env.TIMEOUT = String(ev.target.context.timeout);
  for (const env of ev.target.context.env) {
    process.env[env.key] = env.value;
  }
  globalThis.require = createRequire(path.join(ev.target.cwd, "node_modules"));
  workerContextInitialized = true;
}

async function _process(ev: event.Event, queue: EventQueue) {
  initializeWorkerContext(ev);

  const callArguments: any[] = [];

  let callback: (arg: any) => Promise<void> = async () => {};

  switch (ev.type) {
    case event.Type.HTTP:
      const httpQueue = new HttpQueue();
      const httpPop = new Http.Request.Pop({
        id: ev.id
      });

      const handleRejection = (error: any) => {
        if (error && "code" in error && error.code == 1) {
          error.details = `The http request "${ev.id}" handled through "${ev.target.handler}" has been cancelled by the user.`;
          console.error(error.details);
          return;
        }
        return Promise.reject(error);
      };

      const request = await httpQueue.pop(httpPop).catch(handleRejection);
      if (!request) {
        queue.complete(new event.Complete({id: ev.id, succedded: false}));
        return;
      }

      const response = new Response(
        (e: any) => {
          e.id = ev.id;
          return httpQueue.writeHead(e).catch(handleRejection) as unknown as Promise<void>;
        },
        (e: any) => {
          e.id = ev.id;
          return httpQueue.write(e).catch(handleRejection) as unknown as Promise<void>;
        },
        (e: any) => {
          e.id = ev.id;
          return httpQueue.end(e).catch(handleRejection) as unknown as Promise<void>;
        }
      );

      callArguments[0] = new Request(request);
      callArguments[1] = response;

      callback = async (result: any) => {
        if (!response.headersSent && result != undefined) {
          if (result instanceof Promise) {
            result = await result.catch((e: any) => {
              if (!response.headersSent) {
                const responseObj: any = {statusCode: 500, error: "Internal Server Error"};

                if (e) {
                  responseObj.message = e.toString();
                }
                response.status(500).send(responseObj);
              }
              return Promise.reject(e);
            });
          }

          if (result != undefined && !response.headersSent) {
            return response.send(result);
          }
        }
      };
      break;
    case event.Type.DATABASE:
      const database = new DatabaseQueue();
      const databasePop = new Database.Change.Pop({
        id: ev.id
      });
      const change = await database.pop(databasePop);
      callArguments[0] = new Change(change);
      break;
    case event.Type.FIREHOSE:
      const firehose = new FirehoseQueue();
      const {
        client: clientDescription,
        pool: poolDescription,
        message
      } = await firehose.pop(
        new Firehose.Message.Pop({
          id: ev.id
        })
      );
      callArguments[1] = new Message(message);
      callArguments[0] = {
        socket: new FirehoseSocket(
          clientDescription,
          () => {
            firehose.close(
              new Firehose.Close({
                client: clientDescription
              })
            );
          },
          (message: any) => {
            firehose.send(
              new Firehose.Message.Outgoing({
                client: clientDescription,
                message
              })
            );
          }
        ),
        pool: new FirehosePool(poolDescription, (message: any) => firehose.sendAll(message))
      };
      break;
    case event.Type.SCHEDULE:
    case event.Type.SYSTEM:
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    case -1 as any:
      // NO OP
      break;
    case event.Type.BUCKET:
      const changeQueue = new BucketChangeQueue();
      const bucketChange = await changeQueue.pop(
        new BucketHooks.Pop({
          id: ev.id
        })
      );
      callArguments[0] = new BucketChange(bucketChange);
      break;
    case event.Type.RABBITMQ:
      const rabbitmq = new RabbitMQQueue();
      const rabbitmqPop = new RabbitMQ.Message.Pop({
        id: ev.id
      });

      const rabbitmqMessage = await rabbitmq.pop(rabbitmqPop);
      const rabbitmqMessageInstance = new RabbitMQMessage(rabbitmqMessage);

      if (rabbitmqMessageInstance.errorMessage?.length) {
        console.error(Buffer.from(rabbitmqMessageInstance.errorMessage).toString());
        queue.complete(new event.Complete({id: ev.id, succedded: false}));
        return;
      }

      callArguments[0] = {
        content: Buffer.from(rabbitmqMessageInstance.content),
        fields: JSON.parse(rabbitmqMessageInstance.fields),
        properties: JSON.parse(rabbitmqMessageInstance.properties)
      };

      const channel = new RabbitMQChannel(
        (e: any) => {
          e.id = ev.id;
          return rabbitmq.ack(e) as unknown as Promise<void>;
        },
        (e: any) => {
          e.id = ev.id;
          return rabbitmq.nack(e) as unknown as Promise<void>;
        }
      );
      callArguments[1] = channel;
      break;
    case event.Type.GRPC:
      const grpcQueue = new GrpcQueueNode();
      const grpcPop = new GrpcProto.Request.Pop({
        id: ev.id
      });

      const grpcRequest = await grpcQueue.pop(grpcPop);
      let grpcRequestBody: any = {};
      try {
        grpcRequestBody = JSON.parse(grpcRequest.body);
      } catch {
        // empty body
      }

      callArguments[0] = grpcRequestBody;

      callback = async (result: any) => {
        const response = new GrpcProto.Response({
          id: ev.id
        });
        try {
          if (result instanceof Promise) {
            result = await result;
          }
          response.body = JSON.stringify(result || {});
          response.statusCode = 0;
        } catch (e: any) {
          response.error = e ? e.toString() : "Internal error";
          response.statusCode = 13;
        }
        await grpcQueue.respond(response);
      };
      break;
    default:
      exitAbnormally(`Invalid event type received. (${ev.type})`);
      break;
  }

  let module = await import(path.join(ev.target.cwd, ".build", process.env.ENTRYPOINT!));

  if ("default" in module && module.default.__esModule) {
    module = module.default; // Do not ask me why
  }

  try {
    // Call the function
    if (!(ev.target.handler in module)) {
      await queue.complete(new event.Complete({id: ev.id, succedded: false}));
      exitAbnormally(`This function does not export any symbol named '${ev.target.handler}'.`);
    } else if (typeof module[ev.target.handler] != "function") {
      await queue.complete(new event.Complete({id: ev.id, succedded: false}));
      exitAbnormally(
        `This function does export a symbol named '${ev.target.handler}' but it is not a function.`
      );
    }
    await callback(module[ev.target.handler](...callArguments));
    queue.complete(new event.Complete({id: ev.id, succedded: true}));
  } catch (e) {
    queue.complete(new event.Complete({id: ev.id, succedded: false}));
    /* 
      Unhandled promise rejections are changed with Nodejs v15.
      Before v15, unhandled promise rejections were shown on the console with warning.
      After v15, unhandled promise rejections throws an error instead.
      If we throw an error, this worker won't be able to process any further tasks and they will hang until worker timeout.
    */

    // throw e;

    console.error(e);
  }
}

function exitAbnormally(reason?: string): never {
  if (reason) {
    console.error(reason);
  }
  process.exit(126);
}
