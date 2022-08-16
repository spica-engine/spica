import {Controller} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {ClassCommander, REPLICA_ID} from "@spica-server/replication/src";
import {ReplicationTestingModule} from "@spica-server/replication/testing";

@Controller()
export class MockController {
  constructor(private commander: ClassCommander) {
    this.commander.register(this);
  }

  fireFn1(arg1, arg2) {
    this.commander.emit({
      command: {class: this.constructor.name, handler: "fn1", args: [arg1, arg2]}
    });
    this.fn1(arg1, arg2);
  }

  fn1(arg1, args2) {}

  fireFn2() {
    this.commander.emit({
      command: {class: this.constructor.name, handler: "fn2", args: []}
    });
    this.fn2();
  }

  fn2() {}

  fireNonExistFn() {
    this.commander.emit({
      command: {class: this.constructor.name, handler: "nonexistFn", args: []}
    });
  }

  fireFailedFn() {
    this.commander.emit({
      command: {class: this.constructor.name, handler: "failedFn", args: ["arg1"]}
    });
  }

  failedFn() {
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

  it("should execute command on all other controllers", () => {
    spyOn(ctrl1, "fn1");
    spyOn(ctrl1, "fn2");

    spyOn(ctrl2, "fn1");
    spyOn(ctrl2, "fn2");

    ctrl1.fireFn1("call", "me");

    expect(ctrl1.fn1).toHaveBeenCalledTimes(1);
    expect(ctrl1.fn2).not.toHaveBeenCalled();

    expect(ctrl2.fn1).toHaveBeenCalledOnceWith("call", "me");
    expect(ctrl2.fn2).not.toHaveBeenCalled();
  });

  it("should log error if nonexist command emitted", () => {
    spyOn(console, "error");

    ctrl1.fireNonExistFn();

    expect(console.error).toHaveBeenCalledOnceWith(
      `Replica ${replica2Id} has no method named nonexistFn`
    );
  });

  it("should log error if command execution failed", () => {
    const err = spyOn(console, "error");

    ctrl1.fireFailedFn();

    expect(err.calls.allArgs()).toEqual([
      [`Replica ${replica2Id} has failed to execute command MockController.failedFn(arg1)`],
      [Error("Failed!")]
    ]);
  });
});
