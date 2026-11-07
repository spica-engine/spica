import {provideRepository} from "@spica-server/data";
import {WEBHOOK_LOG_REPOSITORY} from "@spica-server/interface-function-webhook";
import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {clearStorage, contractSuite, idAt} from "@spica-server/database-testing";
import {WebhookLogController} from "@spica-server/function-webhook/src/log.controller";
import {PassportTestingModule} from "@spica-server/passport-testing";
import {WEBHOOK_OPTIONS} from "@spica-server/interface-function-webhook";
import {ID_TYPES, IdTypes} from "@spica-server/interface-data";

contractSuite("Webhook Log Controller", engine => {
  let request: Request;
  let app: INestApplication;
  let service: any;
  let today: Date;
  let yesterday: Date;
  let module: TestingModule;
  let logIds: any[];
  let firstWebhook: string;
  let secondWebhook: string;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [engine.module(), CoreTestingModule, PassportTestingModule.initialize()],
      controllers: [WebhookLogController],
      providers: [
        provideRepository(WEBHOOK_LOG_REPOSITORY),
        {
          provide: WEBHOOK_OPTIONS,
          useValue: {
            expireAfterSeconds: 5
          }
        }
      ]
    }).compile();

    request = module.get(Request);

    app = module.createNestApplication();

    await app.listen(request.socket);

    service = module.get(WEBHOOK_LOG_REPOSITORY);
  });

  beforeEach(async () => {
    today = new Date();
    yesterday = new Date(today.getTime() - 86400000);

    const webhookIds = module.get<IdTypes>(ID_TYPES).forCollection("webhook");
    firstWebhook = String(webhookIds.generate());
    secondWebhook = String(webhookIds.generate());

    logIds = [];
    for (const log of [
      {
        _id: idAt(engine, today),
        content: {
          request: {
            body: "req_body",
            headers: {test_key: "test_value"},
            url: "url"
          },
          response: {
            body: "res_body",
            headers: {test_key: ["test_value"]},
            status: 404,
            statusText: "BAD REQUEST"
          }
        },
        succeed: false,
        webhook: firstWebhook,
        created_at: today
      },
      {
        _id: idAt(engine, yesterday),
        content: {
          request: {
            body: "req_body2",
            headers: {test_key: "test_value2"},
            url: "url2"
          },
          response: {
            body: "res_body2",
            headers: {test_key: ["test_value2"]},
            status: 201,
            statusText: "CREATED"
          }
        },
        succeed: true,
        webhook: secondWebhook,
        created_at: yesterday
      }
    ]) {
      logIds.push((await service.insert(log))._id);
    }
  });

  afterEach(async () => {
    await clearStorage(engine, module, {mongodb: ["webhook_logs"], postgresql: ["webhook_logs"]});
  });

  it("should get all logs", async () => {
    const response = await request.get("/webhook/logs", {});

    expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
    expect(response.body).toEqual([
      {
        _id: String(logIds[0]),
        content: {
          request: {
            body: "req_body",
            headers: {test_key: "test_value"},
            url: "url"
          },
          response: {
            body: "res_body",
            headers: {test_key: ["test_value"]},
            status: 404,
            statusText: "BAD REQUEST"
          }
        },
        succeed: false,
        webhook: firstWebhook,
        created_at: today.toISOString()
      },
      {
        _id: String(logIds[1]),
        content: {
          request: {
            body: "req_body2",
            headers: {test_key: "test_value2"},
            url: "url2"
          },
          response: {
            body: "res_body2",
            headers: {test_key: ["test_value2"]},
            status: 201,
            statusText: "CREATED"
          }
        },
        succeed: true,
        webhook: secondWebhook,
        created_at: yesterday.toISOString()
      }
    ]);
  });

  it("should limit and skip", async () => {
    const response = await request.get("/webhook/logs", {skip: 1, limit: 1});

    expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
    expect(response.body).toEqual([
      {
        _id: String(logIds[1]),
        content: {
          request: {
            body: "req_body2",
            headers: {test_key: "test_value2"},
            url: "url2"
          },
          response: {
            body: "res_body2",
            headers: {test_key: ["test_value2"]},
            status: 201,
            statusText: "CREATED"
          }
        },
        succeed: true,
        webhook: secondWebhook,
        created_at: yesterday.toISOString()
      }
    ]);
  });

  it("should filter by webhook", async () => {
    const response = await request.get("/webhook/logs", {webhook: firstWebhook});

    expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
    expect(response.body).toEqual([
      {
        _id: String(logIds[0]),
        content: {
          request: {
            body: "req_body",
            headers: {test_key: "test_value"},
            url: "url"
          },
          response: {
            body: "res_body",
            headers: {test_key: ["test_value"]},
            status: 404,
            statusText: "BAD REQUEST"
          }
        },
        succeed: false,
        webhook: firstWebhook,
        created_at: today.toISOString()
      }
    ]);
  });

  it("should filter by succeed value", async () => {
    const response = await request.get("/webhook/logs", {succeed: true});

    expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
    expect(response.body).toEqual([
      {
        _id: String(logIds[1]),
        content: {
          request: {
            body: "req_body2",
            headers: {test_key: "test_value2"},
            url: "url2"
          },
          response: {
            body: "res_body2",
            headers: {test_key: ["test_value2"]},
            status: 201,
            statusText: "CREATED"
          }
        },
        succeed: true,
        webhook: secondWebhook,
        created_at: yesterday.toISOString()
      }
    ]);
  });

  it("should filter by date", async () => {
    const begin = new Date(today);
    begin.setHours(0);
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);

    const response = await request.get("/webhook/logs", {
      begin: begin.toISOString(),
      end: end.toISOString()
    });

    expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
    expect(response.body).toEqual([
      {
        _id: String(logIds[0]),
        content: {
          request: {
            body: "req_body",
            headers: {test_key: "test_value"},
            url: "url"
          },
          response: {
            body: "res_body",
            headers: {test_key: ["test_value"]},
            status: 404,
            statusText: "BAD REQUEST"
          }
        },
        succeed: false,
        webhook: firstWebhook,
        created_at: today.toISOString()
      }
    ]);
  });

  it("should delete specific log", async () => {
    const response = await request.delete(`/webhook/logs/${String(logIds[0])}`);
    expect([response.statusCode, response.statusText]).toEqual([204, "No Content"]);
  });

  it("should delete all logs", async () => {
    const response = await request.delete("/webhook/logs", logIds);
    expect([response.statusCode, response.statusText]).toEqual([204, "No Content"]);
  });

  afterAll(async () => {
    await app.close();
  });
});
