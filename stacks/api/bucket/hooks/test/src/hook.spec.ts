import {Test, TestingModule} from "@nestjs/testing";
import {ActionEnqueuer, hookModuleProviders} from "@spica-server/bucket/hooks";
import {Bucket, ServicesModule} from "@spica-server/bucket/services";
import {BucketService} from "@spica-server/bucket/services/bucket.service";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {SCHEMA} from "@spica-server/function";
import {EventQueue} from "@spica-server/function/queue";
import {Event} from "@spica-server/function/queue/proto";
import {PreferenceModule} from "@spica-server/preference";

class MockBucketService extends BucketService {
  find(filter?: any): Promise<Bucket[]> {
    return new Promise(resolve =>
      resolve([
        {primary: "primary_1", _id: new ObjectId("5e4e8320a28c2f494c588aea")},
        {primary: "primary_2", _id: new ObjectId("5e4e8320a28c2f494c588aeb")}
      ])
    );
  }
}

describe("bucket hooks", () => {
  describe("schema", () => {
    let module: TestingModule;
    beforeAll(async () => {
      module = await Test.createTestingModule({
        imports: [ServicesModule, DatabaseTestingModule.create(), PreferenceModule],
        providers: hookModuleProviders
      })
        .overrideProvider(BucketService)
        .useClass(MockBucketService)
        .compile();
    });

    it("should get bucket schema with name", async () => {
      const schemaWithName = module.get(SCHEMA);
      expect(schemaWithName.name).toEqual("bucket");
      const schema = await schemaWithName.schema();
      expect(schema).toEqual({
        $id: "http://spica.internal/function/enqueuer/bucket",
        type: "object",
        required: ["bucket", "type"],
        properties: {
          bucket: {
            title: "Bucket ID",
            type: "string",
            enum: ["5e4e8320a28c2f494c588aea", "5e4e8320a28c2f494c588aeb"]
          },
          type: {
            title: "Operation type",
            description: "Event Type",
            type: "string",
            enum: ["INSERT", "UPDATE", "GET", "INDEX"]
          }
        },
        additionalProperties: false
      });
    });
  });

  describe("enqueuer", () => {
    let actionEnqueuer: ActionEnqueuer;
    let noopTarget: Event.Target;
    let noopTarget2: Event.Target;
    let eventQueue: jasmine.SpyObj<EventQueue>;

    beforeEach(() => {
      eventQueue = jasmine.createSpyObj("eventQueue", ["enqueue"]);
      actionEnqueuer = new ActionEnqueuer(eventQueue, null, null);

      noopTarget = new Event.Target();
      noopTarget.cwd = "/tmp/fn1";
      noopTarget.handler = "default";

      noopTarget2 = new Event.Target();
      noopTarget2.cwd = "/tmp/fn2";
      noopTarget2.handler = "test_handler";
    });

    afterEach(() => {
      eventQueue.enqueue.calls.reset();
    });

    function addMockActions() {
      actionEnqueuer["actions"] = [
        {options: {collection: "test_collection", type: "INSERT"}, target: noopTarget},
        {options: {collection: "test_collection", type: "INSERT"}, target: noopTarget2},
        {options: {collection: "test_collection", type: "GET"}, target: noopTarget}
      ];
    }

    it("should add action to actions", () => {
      actionEnqueuer.subscribe(noopTarget, {
        bucket: "test_collection",
        type: "INSERT"
      });

      expect(actionEnqueuer["actions"]).toEqual([
        {
          target: noopTarget,
          options: {
            collection: "test_collection",
            type: "INSERT"
          }
        }
      ]);
    });

    it("should start given actions to run", () => {
      addMockActions();

      //actionEnqueuer.startToRun({collection: "test_collection", type: "INSERT"});

      expect(eventQueue.enqueue).toHaveBeenCalledTimes(2);
      expect(eventQueue.enqueue).toHaveBeenCalledWith(
        new Event.Event({type: -1, target: noopTarget})
      );
      expect(eventQueue.enqueue).toHaveBeenCalledWith(
        new Event.Event({type: -1, target: noopTarget2})
      );
    });

    it("should unsubscribe from action", () => {
      addMockActions();

      actionEnqueuer.unsubscribe(noopTarget);

      expect(actionEnqueuer["actions"]).toEqual([
        {options: {collection: "test_collection", type: "INSERT"}, target: noopTarget2}
      ]);
    });
  });
});
