import {Action} from "@spica-server/bucket/hooks/proto";
import {ActionParameters} from "@spica-server/bucket/hooks/proto/node";
import {ActionQueue} from "@spica-server/bucket/hooks/proto/node/queue";
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
  const queue = new EventQueue();
  const pop = new Event.Pop({
    id: process.env.WORKER_ID
  });
  const event: Event.Event | undefined = await queue.pop(pop).catch(e => {
    console.log(e);
    return undefined;
  });

  if (!event) {
    exitAbnormally("There is no event in the queue.");
  }

  process.chdir(path.join(event.target.cwd, ".build"));

  const callArguments = [];
  let callback = (r: unknown) => {};

  switch (event.type) {
    case Event.Type.HTTP:
      const httpQueue = new HttpQueue();
      const httpPop = new Http.Request.Pop();
      httpPop.id = event.id;
      const request = await httpQueue.pop(httpPop);
      callArguments[0] = new Request(request);
      callArguments[1] = new Response(
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
      );
      break;
    case Event.Type.DATABASE:
      const database = new DatabaseQueue();
      const databasePop = new Database.Change.Pop();
      databasePop.id = event.id;
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
      const actionQueue = new ActionQueue();
      const actionParams = await actionQueue.pop(
        new Action.Action.Pop({
          id: event.id
        })
      );
      callArguments[0] = new ActionParameters(actionParams);
      callback = async result => {
        result = await result;
        await actionQueue.result(
          new Action.Result({
            id: event.id,
            result: JSON.stringify(result)
          })
        );
      };
      break;
    default:
      exitAbnormally(`Invalid event type received. (${event.type})`);
      break;
  }

  const fn = await import(path.join(process.cwd(), process.env.ENTRYPOINT));

  // Call the function
  if (!(event.target.handler in fn)) {
    callback(undefined);
    exitAbnormally(`This function does not export any symbol named '${event.target.handler}'.`);
  } else if (typeof fn[event.target.handler] != "function") {
    callback(undefined);
    exitAbnormally(
      `This function does export a symbol named '${event.target.handler}' yet it is not a function.`
    );
  } else {
    callback(fn[event.target.handler](...callArguments));
  }
})();

function exitAbnormally(reason: string) {
  console.error(reason);
  process.exit(126);
}
