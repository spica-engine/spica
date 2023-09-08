import {Controller} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseService, DatabaseTestingModule, MongoClient} from "@spica-server/database/testing";
import {ClassCommander, REPLICA_ID, ReplicationModule} from "@spica-server/replication/src";

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

@Controller()
export class SyncController {
  calls = {fn1: [], fn2: [], failedFn: []};

  commanderSubs;
  constructor(private commander: ClassCommander) {
    this.commanderSubs = this.commander.register(this, [this.fn1, this.fn2]);
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
    this.commanderSubs = this.commander.register(this, [this.fn1], "shift");
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

    function getModuleBuilder() {
      return Test.createTestingModule({
        imports: [DatabaseTestingModule.replicaSet(), ReplicationModule.forRoot()],
        controllers: [SyncController]
      });
    }

    beforeEach(async () => {
      const mb = getModuleBuilder();
      module1 = await mb.compile();
      ctrl1 = module1.get(SyncController);

      module2 = await mb
        .overrideProvider(MongoClient)
        .useValue(module1.get(MongoClient))
        .overrideProvider(DatabaseService)
        .useValue(module1.get(DatabaseService))
        .compile();

      ctrl2 = module2.get(SyncController);
    });

    afterEach(async () => {
      await module1.close();
      await module2.close();
    });

    it("should execute command on all other controllers", async () => {
      ctrl1.fn1("call", "me");

      await wait(2000);

      expect(ctrl1.calls.fn1).toEqual([["call", "me"]]);
      expect(ctrl1.calls.fn2).toEqual([]);
      expect(ctrl1.calls.failedFn).toEqual([]);

      expect(ctrl2.calls.fn1).toEqual([["call", "me"]]);
      expect(ctrl2.calls.fn2).toEqual([]);
      expect(ctrl2.calls.failedFn).toEqual([]);
    });

    it("should unsubscribe from commander", async () => {
      ctrl1.unregister();
      ctrl1.fn1("call", "me");
      await wait(2000);

      expect(ctrl1.calls.fn1).toEqual([["call", "me"]]);

      expect(ctrl2.calls.fn1).toEqual([]);
    });
  });

  describe("Shifting", () => {
    let module1: TestingModule;
    let module2: TestingModule;

    let ctrl1: ShiftController;
    let ctrl2: ShiftController;

    function getModuleBuilder() {
      return Test.createTestingModule({
        imports: [DatabaseTestingModule.replicaSet(), ReplicationModule.forRoot()],
        controllers: [ShiftController]
      });
    }

    beforeEach(async () => {
      const mb = getModuleBuilder();
      module1 = await mb.compile();
      ctrl1 = module1.get(ShiftController);

      module2 = await mb
        .overrideProvider(MongoClient)
        .useValue(module1.get(MongoClient))
        .overrideProvider(DatabaseService)
        .useValue(module1.get(DatabaseService))
        .compile();

      ctrl2 = module2.get(ShiftController);
    });

    afterEach(async () => {
      await module1.close();
      await module2.close();
    });

    it("should execute command on all controllers", async () => {
      ctrl1.fn1("call", "me");
      await wait(2000);

      expect(ctrl1.calls.fn1).toEqual([]);

      expect(ctrl2.calls.fn1).toEqual([["call", "me"]]);
    });
  });
});
