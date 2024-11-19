import {Node} from "@spica/api/src/function/runtime/node";

describe("Node", () => {
  let node: Node;

  beforeEach(async () => {
    node = new Node();
  });

  it("should kill the process", () => {
    const worker = node.spawn({id: "test", env: {}});
    expect(worker["_process"].killed).toEqual(false);
    worker.kill();
    expect(worker["_process"].killed).toEqual(true);
  });
});
