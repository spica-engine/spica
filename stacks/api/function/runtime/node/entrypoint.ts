import {EventQueue, HttpQueue} from "@spica-server/function/queue/node";
import {Event} from "@spica-server/function/queue/proto";
import * as path from "path";

if (!process.env.ENTRYPOINT) {
  exitAbnormally("Environment variable ENTRYPOINT was not set.");
}

(async () => {
  const queue = new EventQueue();
  
  const event = await queue.pop().catch(() => undefined);

  if (!event) {
    exitAbnormally("There is no event in the queue.");
  }

  const fn = await import(path.join(process.cwd(), process.env.ENTRYPOINT));

  const callArguments = [];

  let queue: HttpQueue = 

  switch (event.type) {
    case Event.Type.HTTP:
      
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
