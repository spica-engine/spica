import {PassThroughOutput} from "@spica-server/function/runtime/io";

describe("IO Passthrough", () => {
  let io: PassThroughOutput;

  beforeEach(() => {
    io = new PassThroughOutput();
  });

  it("should create a writable stream", () => {
    const stream = io.create({eventId: "event", functionId: "test"});
    expect(stream.writable).toBe(true);
  });
});
