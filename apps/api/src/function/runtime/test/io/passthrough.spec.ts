import {PassThroughOutput} from "../../io";

describe("IO Passthrough", () => {
  let io: PassThroughOutput;

  beforeEach(() => {
    io = new PassThroughOutput();
  });

  it("should create a writable stream", () => {
    const [stdout] = io.create({eventId: "event", functionId: "test"});
    expect(stdout.writable).toBe(true);
  });
});
