import {TestingModule, Test} from "@nestjs/testing";
import {hookModuleProviders, SCHEMA} from "@spica-server/bucket/hooks/src/hook.module";
import {BucketEnqueuer} from "@spica-server/bucket/hooks/src/enqueuer";
import {ServicesModule, Bucket} from "@spica-server/bucket/services";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {PreferenceModule} from "@spica-server/preference";
import {BucketService} from "@spica-server/bucket/services/bucket.service";
import {Event} from "@spica-server/function/queue/proto";
import {EventQueue} from "@spica-server/function/queue";

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

describe("hook module", () => {
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
        required: ["collection", "type"],
        properties: {
          collection: {
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
    let bucketEnqueuer: BucketEnqueuer;
    let noopTarget: Event.Target;
    let noopTarget2: Event.Target;
    let eventQueue: jasmine.SpyObj<EventQueue>;
    beforeEach(() => {
      eventQueue = jasmine.createSpyObj("eventQueue", ["enqueue"]);

      bucketEnqueuer = new BucketEnqueuer(eventQueue);

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
      bucketEnqueuer["actions"] = [
        {options: {collection: "test_collection", type: "INSERT"}, target: noopTarget},
        {options: {collection: "test_collection", type: "INSERT"}, target: noopTarget2},
        {options: {collection: "test_collection", type: "GET"}, target: noopTarget}
      ];
    }

    it("should add action to actions", () => {
      bucketEnqueuer.subscribe(noopTarget, {
        collection: "test_collection",
        type: "INSERT"
      });

      expect(bucketEnqueuer["actions"]).toEqual([
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

      bucketEnqueuer.startToRun({collection: "test_collection", type: "INSERT"});

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

      bucketEnqueuer.unsubscribe(noopTarget);

      expect(bucketEnqueuer["actions"]).toEqual([
        {options: {collection: "test_collection", type: "INSERT"}, target: noopTarget2}
      ]);
    });
  });
});
