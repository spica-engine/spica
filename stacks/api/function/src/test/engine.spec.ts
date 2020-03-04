import {FunctionEngine} from "@spica-server/function/src/engine";
import {FunctionService, TargetChange, ChangeKind} from "../function.service";
import {DatabaseService} from "@spica-server/database";
import {Test} from "@nestjs/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {HorizonModule, Horizon} from "@spica-server/function/horizon";

describe("engine", () => {
  let engine: FunctionEngine;
  let subscribeSpy: jasmine.Spy;
  let unsubscribeSpy: jasmine.Spy;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [HorizonModule, DatabaseTestingModule.create()]
    }).compile();

    let horizon = module.get(Horizon);
    let database = module.get(DatabaseService);

    engine = new FunctionEngine(
      new FunctionService(database),
      database,
      horizon,
      {root: "test_root"},
      null
    );

    subscribeSpy = spyOn<any>(engine, "subscribe").and.returnValue(null);
    unsubscribeSpy = spyOn<any>(engine, "unsubscribe").and.returnValue(null);
  });

  afterEach(() => {
    subscribeSpy.calls.reset();
    unsubscribeSpy.calls.reset();
  });

  it("should subscribe to new trigger if ChangeKind is Added", () => {
    let changes: TargetChange = {
      kind: ChangeKind.Added,
      target: {
        id: "test_id",
        handler: "test_handler"
      }
    };

    engine.categorizeChanges([changes]);

    expect(subscribeSpy).toHaveBeenCalledTimes(1);
    expect(subscribeSpy).toHaveBeenCalledWith(changes);

    expect(unsubscribeSpy).toHaveBeenCalledTimes(0);
  });

  it("should unsubscribe from removed trigger if ChangeKind is Removed", () => {
    let changes: TargetChange = {
      kind: ChangeKind.Removed,
      target: {
        id: "test_id",
        handler: "test_handler"
      }
    };

    engine.categorizeChanges([changes]);

    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    expect(unsubscribeSpy).toHaveBeenCalledWith("test_root/test_id");

    expect(subscribeSpy).toHaveBeenCalledTimes(0);
  });

  it("should call unsubscribe for once then call subsribe for all triggers if ChangeKind is Updated", () => {
    let changes: TargetChange[] = [
      {
        kind: ChangeKind.Updated,
        target: {
          id: "test_id",
          handler: "test_handler"
        }
      },
      {
        kind: ChangeKind.Updated,
        target: {
          id: "test_id",
          handler: "test_handler2"
        }
      }
    ];

    engine.categorizeChanges(changes);

    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    expect(unsubscribeSpy).toHaveBeenCalledWith("test_root/test_id");

    expect(subscribeSpy).toHaveBeenCalledTimes(2);
    expect(subscribeSpy.calls.all().map(call => call.args)).toEqual([[changes[0]], [changes[1]]]);
  });
});
