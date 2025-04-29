import * as BucketHooksProtoNode from "@spica-server/bucket/hooks/proto/node";
const {ChangeQueue: BucketChangeQueue, Change: BucketChange} = BucketHooksProtoNode;

import * as BucketHooksProto from "@spica-server/bucket/hooks/proto";
const {hooks: BucketHooks} = BucketHooksProto;

import * as FnQueueNode from "@spica-server/function/queue/node";

const {
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
  RabbitMQChannel
} = FnQueueNode;

import * as FnQueueProto from "@spica-server/function/queue/proto";
const {Database, event, Firehose, Http, RabbitMQ} = FnQueueProto;

import {createRequire} from "module";
import * as path from "path";

import * as Logger from "@spica-server/function/runtime/logger";
const {getLoggerConsole} = Logger;

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
  let ev;
  while (
    (ev = await queue.pop(pop).catch(e => {
      if (typeof e == "object" && e.code == 5) {
        return Promise.resolve();
      }
      return Promise.reject(e);
    }))
  ) {
    await _process(ev, queue);
  }
})();

async function initialize() {
  if (process.env.__EXPERIMENTAL_DEVKIT_DATABASE_CACHE) {
    const _require = globalThis.require;
    globalThis.require = createRequire(path.join(process.cwd(), "external/npm/node_modules"));
    await import("./experimental_database.js");
    globalThis.require = _require;
  }
}

async function _process(ev, queue) {
  process.chdir(ev.target.cwd);

  process.env.TIMEOUT = String(ev.target.context.timeout);

  for (const env of ev.target.context.env) {
    process.env[env.key] = env.value;
  }

  const callArguments = [];

  let callback = async arg => {};

  switch (ev.type) {
    case event.Type.HTTP:
      const httpQueue = new HttpQueue();
      const httpPop = new Http.Request.Pop({
        id: ev.id
      });

      const handleRejection = error => {
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
        e => {
          e.id = ev.id;
          return httpQueue.writeHead(e).catch(handleRejection);
        },
        e => {
          e.id = ev.id;
          return httpQueue.write(e).catch(handleRejection);
        },
        e => {
          e.id = ev.id;
          return httpQueue.end(e).catch(handleRejection);
        }
      );

      callArguments[0] = new Request(request);
      callArguments[1] = response;

      callback = async result => {
        if (!response.headersSent && result != undefined) {
          if (result instanceof Promise) {
            result = await result.catch(e => {
              if (!response.headersSent) {
                const responseObj = {statusCode: 500, error: "Internal Server Error"};

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
          message => {
            firehose.send(
              new Firehose.Message.Outgoing({
                client: clientDescription,
                message
              })
            );
          }
        ),
        pool: new FirehosePool(poolDescription, message => firehose.sendAll(message))
      };
      break;
    case event.Type.SCHEDULE:
    case event.Type.SYSTEM:
    case -1:
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
      const rabbitmqPop = new RabbitMQ.RabbitMQMessage.Pop({
        id: ev.id
      });

      const rabbitmqMessage = await rabbitmq.pop(rabbitmqPop);
      const rabbitmqMessageInstance = new RabbitMQMessage(rabbitmqMessage);

      callArguments[0] = {
        content: Buffer.from(rabbitmqMessageInstance.content),
        fields: JSON.parse(rabbitmqMessageInstance.fields),
        properties: JSON.parse(rabbitmqMessageInstance.properties)
      };

      const channel = new RabbitMQChannel(e => {
        console.log("2 eeeeeeeee: ", e);
        e.id = ev.id;
        return rabbitmq.ack(e);
      });
      callArguments[1] = channel;
      break;
    default:
      exitAbnormally(`Invalid event type received. (${ev.type})`);
      break;
  }

  globalThis.require = createRequire(path.join(process.cwd(), "node_modules"));

  let module = await import(
    path.join(process.cwd(), ".build", process.env.ENTRYPOINT) + "?event=" + ev.id
  );

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

function exitAbnormally(reason) {
  if (reason) {
    console.error(reason);
  }
  process.exit(126);
}
