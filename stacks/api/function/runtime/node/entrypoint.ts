import {
  Change,
  DatabaseQueue,
  EventQueue,
  HttpQueue,
  Request,
  Response
} from "@spica-server/function/queue/node";
import {Database, Event, Http} from "@spica-server/function/queue/proto";
import * as path from "path";

if (!process.env.ENTRYPOINT) {
  exitAbnormally("Environment variable ENTRYPOINT was not set.");
}

if (!process.env.EVENT_ID) {
  exitAbnormally("Environment variable EVENT_ID was not set.");
}

(async () => {
  const queue = new EventQueue();
  const pop = new Event.Pop();
  pop.id = process.env.EVENT_ID;
  const event = await queue.pop(pop).catch(e => {
    console.log(e);
    return undefined;
  });

  if (!event) {
    exitAbnormally("There is no event in the queue.");
  }

  const callArguments = [];

  switch (event.type) {
    case Event.Type.HTTP:
      const httpQueue = new HttpQueue();
      // TODO: change this particular pop message with the generic Event.Pop message.
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
      // TODO
      break;
    case Event.Type.SCHEDULE:
      // TODO
      break;
    case -1:
      // NO OP
      break;
    default:
      exitAbnormally(`Invalid event type received. (${event.type})`);
      break;
  }

  const fn = await import(path.join(process.cwd(), process.env.ENTRYPOINT));

  // Call the function
  fn[event.target.handler](...callArguments);
})();

function exitAbnormally(reason: string) {
  console.error(reason);
  process.exit(126);
}
