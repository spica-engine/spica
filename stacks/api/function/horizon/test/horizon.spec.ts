import {Horizon} from "@spica-server/function/horizon/src";
import {Event} from "@spica-server/function/queue/proto";
import {FunctionTestBed} from "@spica-server/function/runtime/testing";

describe("horizon", () => {
  let horizon: Horizon;

  beforeEach(() => {
    horizon = new Horizon(null);
  });

  afterEach(() => {
    horizon.kill();
  });

  it("should create horizon", () => {
    expect(horizon).toBeTruthy();
  });

  describe("runtime", () => {
    const compilation = {
      cwd: undefined,
      entrypoint: "index.ts"
    };

    beforeAll(async () => {
      compilation.cwd = FunctionTestBed.initialize(`export default function() {}`);
      await horizon["runtime"].compile(compilation);
    });

    it("should execute", () => {
      const event = new Event.Event();
      const target = new Event.Target();
      target.handler = "default";
      target.cwd = compilation.cwd;
      event.type = Event.Type.HTTP;
      event.target = target;
      horizon.enqueue(event);
    });
  });
});
