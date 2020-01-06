import {EventQueue, HttpQueue, Request, Response} from "@spica-server/function/queue/node";
import {Event, Http} from "@spica-server/function/queue/proto";
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

  const fn = await import(path.join(process.cwd(), process.env.ENTRYPOINT));

  const callArguments = [];

  let httpQueue: HttpQueue;

  switch (event.type) {
    case Event.Type.HTTP:
      httpQueue = new HttpQueue();
      // TODO: change this particular pop message with the generic Event.Pop message.
      const pop = new Http.Request.Pop();
      pop.id = event.id;
      const request = await httpQueue.pop(pop);
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
      // TODO
      break;
    case Event.Type.FIREHOSE:
      // TODO
      break;
    case Event.Type.SCHEDULE:
      // TODO
      break;
    case -1:
      // NO OP
      console.warn("NO-OP event type received");
      break;
    default:
      exitAbnormally(`Invalid event type received. (${event.type})`);
      break;
  }

  // Call the function
  fn[event.target.handler](...callArguments);
})();

function exitAbnormally(reason: string) {
  console.error(reason);
  process.exit(126);
}
