import {EventQueue} from "@spica-server/function/queue/node";

(async function() {
  const queue = new EventQueue();
  const value = await queue.pop();
  console.log(value);
  console.log(process.env);
  console.log(process.cwd());
})();
