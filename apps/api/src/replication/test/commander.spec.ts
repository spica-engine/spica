import {Controller} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {
  DatabaseService,
  DatabaseTestingModule,
  getConnectionUri
} from "@spica-server/database/testing";
import {ClassCommander, ReplicationModule} from "@spica-server/replication/src";
import {CommandType} from "@spica-server/interface/replication";

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
@Controller()
export class SyncController {
  calls = {fn1: [], fn2: []};
  commanderSubs;
  constructor(private commander: ClassCommander) {
    this.commanderSubs = this.commander.register(this, [this.fn1, this.fn2], CommandType.SYNC);
  }
  fn1(arg1, arg2) {
    this.calls.fn1.push([arg1, arg2]);
  }
  fn2() {
    this.calls.fn2.push([]);
  }
  unregister() {
    this.commanderSubs.unsubscribe();
  }
}
@Controller()
export class ShiftController {
  calls = {fn1: []};
  commanderSubs;
  constructor(private commander: ClassCommander) {
    this.commanderSubs = this.commander.register(this, [this.fn1], CommandType.SHIFT);
  }
  fn1(arg1, arg2) {
    this.calls.fn1.push([arg1, arg2]);
  }
}
describe("Commander", () => {
  describe("Sync", () => {
    let module1: TestingModule;
    let module2: TestingModule;
    let ctrl1: SyncController;
    let ctrl2: SyncController;

    function getModuleBuilder(connectionUri?: string) {
      return Test.createTestingModule({
        imports: [
          connectionUri
            ? DatabaseTestingModule.connect(connectionUri)
            : DatabaseTestingModule.replicaSet(),
          ReplicationModule.forRoot()
        ],
        controllers: [SyncController]
      });
    }
    beforeEach(async () => {
      module1 = await getModuleBuilder().compile();
      ctrl1 = module1.get(SyncController);

      const connectionUri = getConnectionUri();
      module2 = await getModuleBuilder(connectionUri).compile();

      ctrl2 = module2.get(SyncController);
      await wait(5000);
    });
    afterEach(async () => {
      await module1.close();
      await module2.close();
    });
    it("should emit command to ctrl2", async () => {
      ctrl1.fn1("call", "me");
      await wait(5000);
      expect(ctrl1.calls.fn1).toEqual([["call", "me"]]);
      expect(ctrl2.calls.fn1).toEqual([["call", "me"]]);
      expect(ctrl1.calls.fn2).toEqual([]);
      expect(ctrl2.calls.fn2).toEqual([]);
    });
    it("should emit command to ctrl1", async () => {
      ctrl2.fn1("call", "me");
      await wait(5000);
      expect(ctrl1.calls.fn1).toEqual([["call", "me"]]);
      expect(ctrl2.calls.fn1).toEqual([["call", "me"]]);
      expect(ctrl1.calls.fn2).toEqual([]);
      expect(ctrl2.calls.fn2).toEqual([]);
    });
    it("should unsubscribe ctrl1", async () => {
      ctrl1.unregister();
      ctrl1.fn1("call", "me");
      await wait(4000);
      expect(ctrl1.calls.fn1).toEqual([["call", "me"]]);
      expect(ctrl2.calls.fn1).toEqual([]);
    });
    it("should unsubscribe ctrl2", async () => {
      ctrl2.unregister();
      ctrl1.fn1("call", "me");
      await wait(5000);
      expect(ctrl1.calls.fn1).toEqual([["call", "me"]]);
      expect(ctrl2.calls.fn1).toEqual([]);
    });
  });
  describe("Shifting", () => {
    let module1: TestingModule;
    let module2: TestingModule;
    let ctrl1: ShiftController;
    let ctrl2: ShiftController;

    function getModuleBuilder(connectionUri?: string) {
      return Test.createTestingModule({
        imports: [
          connectionUri
            ? DatabaseTestingModule.connect(connectionUri)
            : DatabaseTestingModule.replicaSet(),
          ReplicationModule.forRoot()
        ],
        controllers: [ShiftController]
      });
    }
    beforeEach(async () => {
      module1 = await getModuleBuilder().compile();
      ctrl1 = module1.get(ShiftController);

      const connectionUri = getConnectionUri();
      module2 = await getModuleBuilder(connectionUri).compile();

      ctrl2 = module2.get(ShiftController);
      await wait(5000);
    });

    afterEach(async () => {
      await module1.close();
      await module2.close();
    });

    it("should shift command to ctrl2", async () => {
      ctrl1.fn1("call", "me");
      await wait(5000);

      expect(ctrl1.calls.fn1).toEqual([]);
      expect(ctrl2.calls.fn1).toEqual([["call", "me"]]);
    });

    it("should shift command to ctrl1", async () => {
      ctrl2.fn1("call", "me");
      await wait(5000);

      expect(ctrl1.calls.fn1).toEqual([["call", "me"]]);
      expect(ctrl2.calls.fn1).toEqual([]);
    });
  });
});
