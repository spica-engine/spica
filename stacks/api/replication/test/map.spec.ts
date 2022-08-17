import {Injectable} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {ClassCommander, ReplicationMap} from "@spica-server/replication/src";
import {ReplicationTestingModule, wait} from "@spica-server/replication/testing";
import {Subject} from "rxjs";

@Injectable()
export class MapConsumer {
  repMap = new ReplicationMap<string, unknown>(this.commander, `${this.constructor.name}.strMap`);
  constructor(private commander: ClassCommander) {}
}

describe("Commander", () => {
  let module1: TestingModule;
  let module2: TestingModule;

  let consumer1: MapConsumer;
  let consumer2: MapConsumer;

  function compileModule() {
    return Test.createTestingModule({
      imports: [ReplicationTestingModule.create()],
      providers: [MapConsumer]
    }).compile();
  }

  beforeEach(async () => {
    module1 = await compileModule();
    consumer1 = module1.get(MapConsumer);

    module2 = await compileModule();
    consumer2 = module2.get(MapConsumer);
  });

  afterEach(async () => {
    await module1.close();
    await module2.close();
  });

  it("should set map value for all replicas", () => {
    consumer1.repMap.set("user1", "secret1");
    expect(consumer2.repMap.get("user1")).toEqual("secret1");
  });

  it("should should work for objects", () => {
    const subject = new Subject();
    consumer1.repMap.set("sb1", subject);

    expect(consumer2.repMap.get("sb1")).toEqual(subject);
  });
});
