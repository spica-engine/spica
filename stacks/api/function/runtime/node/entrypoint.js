import * as Bucket from "@spica-server/bucket/hooks/proto/node";
import {hooks as BucketHooks} from "@spica-server/bucket/hooks/proto";
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
  Response
} from "@spica-server/function/queue/node";
import {Database, Event, Firehose, Http} from "@spica-server/function/queue/proto";
import {createRequire} from "module";
import * as path from "path";

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
  if (process.env.__EXPERIMENTAL_DEVKIT_DATABASE_CACHE) {
    const _require = globalThis.require;
    globalThis.require = createRequire(path.join(process.cwd(), "external/npm/node_modules"));
    await import("./experimental_database");
    globalThis.require = _require;
  }

  process.title = `Runtime: ${process.env.RUNTIME} - ${process.env.WORKER_ID} waiting for the event.`;

  const queue = new EventQueue();
  const pop = new Event.Pop({
    id: process.env.WORKER_ID
  });
  const event = await queue.pop(pop).catch(e => {
    console.error(e);
    return undefined;
  });

  if (!event) {
    exitAbnormally("There is no event in the queue.");
  }

  process.title = `Runtime: ${process.env.RUNTIME} - ${process.env.WORKER_ID} processing the event ${event.id}.`;

  process.chdir(event.target.cwd);

  process.env.TIMEOUT = String(event.target.context.timeout);

  for (const env of event.target.context.env) {
    process.env[env.key] = env.value;
  }

  const callArguments = [];
  let callback = () => {};

  switch (event.type) {
    case Event.Type.HTTP:
      const httpQueue = new HttpQueue();
      const httpPop = new Http.Request.Pop();
      httpPop.id = event.id;
      const request = await httpQueue.pop(httpPop);
      callArguments[0] = new Request(request);
      const response = (callArguments[1] = new Response(
        async e => {
          e.id = event.id;
          await httpQueue.writeHead(e);
        },
        async e => {
          e.id = event.id;
          await httpQueue.write(e);
        },
        async e => {
          e.id = event.id;
          await httpQueue.end(e);
        }
      ));
      callback = async result => {
        if (!response.headersSent && result != undefined) {
          result = await result;
          if (result != undefined && !response.headersSent) {
            response.send(result);
          }
        }
      };
      break;
    case Event.Type.DATABASE:
      const database = new DatabaseQueue();
      const databasePop = new Database.Change.Pop({
        id: event.id
      });
      const change = await database.pop(databasePop);
      callArguments[0] = new Change(change);
      break;
    case Event.Type.FIREHOSE:
      const firehose = new FirehoseQueue();
      const {client: clientDescription, pool: poolDescription, message} = await firehose.pop(
        new Firehose.Message.Pop({
          id: event.id
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
    case Event.Type.SCHEDULE:
    case Event.Type.SYSTEM:
    case -1:
      // NO OP
      break;
    case Event.Type.BUCKET:
      const reviewAndChangeQueue = new Bucket.ReviewAndChangeQueue();
      const reviewOrChange = await reviewAndChangeQueue.pop(
        new BucketHooks.Pop({
          id: event.id
        })
      );

      if (reviewOrChange.review) {
        callArguments[0] = new Bucket.Review(reviewOrChange.review);
        callback = async result => {
          result = await result;
          if (result == undefined || result == null) {
            console.error(
              `Function (${
                event.target.handler
              }) did not return any review response. Expected a review response but got ${typeof result}`
            );
          }
          await reviewAndChangeQueue.result(
            new BucketHooks.Review.Result({
              id: event.id,
              result: JSON.stringify(result),
              type: reviewOrChange.review.type
            })
          );
        };
      } else {
        callArguments[0] = new Bucket.Change(reviewOrChange.change);
      }
      break;
    default:
      exitAbnormally(`Invalid event type received. (${event.type})`);
      break;
  }

  globalThis.require = createRequire(path.join(process.cwd(), "node_modules"));

  let module = await import(path.join(process.cwd(), ".build", process.env.ENTRYPOINT));

  if ("default" in module && module.default.__esModule) {
    module = module.default; // Do not ask me why
  }

  // Call the function
  if (!(event.target.handler in module)) {
    callback(undefined);
    exitAbnormally(`This function does not export any symbol named '${event.target.handler}'.`);
  } else if (typeof module[event.target.handler] != "function") {
    callback(undefined);
    exitAbnormally(
      `This function does export a symbol named '${event.target.handler}' yet it is not a function.`
    );
  } else {
    callback(module[event.target.handler](...callArguments));
  }
})();

function exitAbnormally(reason) {
  console.error(reason);
  process.exit(126);
}
