const {Worker, isMainThread, parentPort} = require("worker_threads");

if (isMainThread) {
    console.log(process.pid);
  process.stdin.once("data", () => {
    for (let i = 1; i < 11; i++) {
      const worker = new Worker(__filename);

      setTimeout(() => {
        worker.postMessage("Hello, world!");
      }, i * 10000);

      worker.once("exit", () => {
        console.log(`worker #${i} quit`);
      });
    }
  });
} else {
  // When a message from the parent thread is received, send it back:
  parentPort.once("message", console.log);
}
