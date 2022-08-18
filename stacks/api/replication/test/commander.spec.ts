import {Controller} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {ClassCommander, REPLICA_ID} from "@spica-server/replication/src";
import {ReplicationTestingModule} from "@spica-server/replication/testing";

@Controller()
export class MockController {
  calls = {fn1: [], fn2: [], failedFn: []};
  constructor(private commander: ClassCommander) {
    this.commander.register(this, [this.fn1, this.fn2, this.failedFn]);
  }

  fn1(arg1, arg2) {
    this.calls.fn1.push([arg1, arg2]);
  }

  fn2() {
    this.calls.fn2.push([]);
  }

  failedFn(arg1) {
    throw Error("Failed!");
  }
}

describe("Commander", () => {
  let module1: TestingModule;
  let module2: TestingModule;

  let replica1Id: string;
  let replica2Id: string;

  let ctrl1: MockController;
  let ctrl2: MockController;

  function compileModule() {
    return Test.createTestingModule({
      imports: [ReplicationTestingModule.create()],
      controllers: [MockController]
    }).compile();
  }

  beforeEach(async () => {
    module1 = await compileModule();
    replica1Id = module1.get(REPLICA_ID);
    ctrl1 = module1.get(MockController);

    module2 = await compileModule();
    replica2Id = module2.get(REPLICA_ID);
    ctrl2 = module2.get(MockController);
  });

  afterEach(async () => {
    await module1.close();
    await module2.close();
  });

  fit("should execute command on all other controllers", () => {
    console.log(ctrl1);
    ctrl1.fn1("call", "me");

    expect(ctrl1.calls.fn1).toEqual([["call", "me"]]);
    expect(ctrl1.calls.fn2).toEqual([]);
    expect(ctrl1.calls.failedFn).toEqual([]);

    expect(ctrl2.calls.fn1).toEqual([["call", "me"]]);
    expect(ctrl2.calls.fn2).toEqual([]);
    expect(ctrl2.calls.failedFn).toEqual([]);
  });

  it("should log error if command execution failed", () => {
    const err = spyOn(console, "error");

    ctrl1.failedFn("*!'^");

    expect(err.calls.allArgs()).toEqual([
      [`Replica ${replica2Id} has failed to execute command MockController.__failedFn__(*!'^)`],
      [Error("Failed!")]
    ]);
  });
});
