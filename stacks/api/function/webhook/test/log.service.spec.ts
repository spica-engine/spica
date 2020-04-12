import {WebhookLogService} from "../src/log.service";
import {TestingModule, Test} from "@nestjs/testing";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";

describe("Webhook Service", () => {
  let service: WebhookLogService;
  let module: TestingModule;
  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.create()],
      providers: [WebhookLogService]
    }).compile();
    service = module.get(WebhookLogService);

    jasmine.addCustomEqualityTester((actual, expected) => {
      if (expected == "object_id" && actual instanceof ObjectId) {
        return true;
      }
    });
  });

  afterEach(async () => await module.close());

  it("should insert a log", async () => {
    await service.insertLog(
      {body: "req_body", headers: {test_key: "test_value"}, url: "url"},
      {
        body: "res_body",
        headers: {test_key: ["test_value"]},
        status: 404,
        statusText: "BAD REQUEST"
      },
      "webhook_id"
    );

    let logs = await service.find({});

    expect(logs).toEqual([
      {
        _id: "object_id" as any,
        webhook: "webhook_id",
        request: {body: "req_body", headers: {test_key: "test_value"}, url: "url"},
        response: {
          body: "res_body",
          headers: {test_key: ["test_value"]},
          status: 404,
          statusText: "BAD REQUEST"
        }
      }
    ]);
  });
});
