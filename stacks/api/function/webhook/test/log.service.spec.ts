import {WebhookLogService} from "../src/log.service";
import {TestingModule, Test} from "@nestjs/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";

describe("Webhook Service", () => {
  let service: WebhookLogService;
  let module: TestingModule;
  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.create()],
      providers: [WebhookLogService]
    }).compile();
    service = module.get(WebhookLogService);
  });

  afterEach(async () => await module.close());

  it("should insert a log", async () => {
    await service.insertLog(
      {body: {test: "request_body"}, headers: {test: "test"}, path: "test_path"},
      {},
      "webhook_id"
    );

    let logs = await service.find({});

    delete logs[0]._id;

    expect(logs).toEqual([
      {
        webhook: "webhook_id",
        request: {body: {test: "request_body"}, headers: {test: "test"}, path: "test_path"},
        response: {
          body: null,
          headers: null,
          status: null,
          statusText: null
        }
      }
    ]);
  });
});
