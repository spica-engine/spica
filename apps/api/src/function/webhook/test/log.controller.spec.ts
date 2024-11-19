import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica/core";
import {DatabaseTestingModule, ObjectId} from "@spica/database";
import {WebhookLogController} from "@spica/api/src/function/webhook/src/log.controller";
import {WebhookLogService} from "@spica/api/src/function/webhook/src/log.service";
import {PassportTestingModule} from "@spica/api/src/passport/testing";
import {WEBHOOK_OPTIONS} from "@spica/api/src/function/webhook";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

describe("Activity Controller", () => {
  let request: Request;
  let app: INestApplication;
  let service: WebhookLogService;
  let today: Date;
  let yesterday: Date;
  let logIds: ObjectId[];

  let created_at = new Date();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.create(),
        CoreTestingModule,
        PassportTestingModule.initialize()
      ],
      controllers: [WebhookLogController],
      providers: [
        WebhookLogService,
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

    service = module.get(WebhookLogService);

    await new Promise(resolve => setTimeout(() => resolve(), 2000));
  });

  beforeEach(async () => {
    today = new Date();
    yesterday = new Date(today.getTime() - 86400000);

    logIds = await service.insertMany([
      {
        _id: ObjectId.createFromTime(today.getTime() / 1000),
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
        webhook: "test_webhook_id",
        created_at
      },
      {
        _id: ObjectId.createFromTime(yesterday.getTime() / 1000),
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
        webhook: "test_webhook_id2",
        created_at
      }
    ]);
  });

  afterEach(async () => {
    await service.deleteMany({});
  });

  it("should get all logs", async () => {
    const response = await request.get("/webhook/logs", {});

    expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
    expect(response.body).toEqual([
      {
        _id: logIds[0].toHexString(),
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
        webhook: "test_webhook_id",
        created_at: created_at.toISOString()
      },
      {
        _id: logIds[1].toHexString(),
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
        webhook: "test_webhook_id2",
        created_at: created_at.toISOString()
      }
    ]);
  });

  it("should limit and skip", async () => {
    const response = await request.get("/webhook/logs", {skip: 1, limit: 1});

    expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
    expect(response.body).toEqual([
      {
        _id: logIds[1].toHexString(),
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
        webhook: "test_webhook_id2",
        created_at: created_at.toISOString()
      }
    ]);
  });

  it("should filter by webhook", async () => {
    const response = await request.get("/webhook/logs", {webhook: "test_webhook_id"});

    expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
    expect(response.body).toEqual([
      {
        _id: logIds[0].toHexString(),
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
        webhook: "test_webhook_id",
        created_at: created_at.toISOString()
      }
    ]);
  });

  it("should filter by succeed value", async () => {
    const response = await request.get("/webhook/logs", {succeed: true});

    expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
    expect(response.body).toEqual([
      {
        _id: logIds[1].toHexString(),
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
        webhook: "test_webhook_id2",
        created_at: created_at.toISOString()
      }
    ]);
  });

  it("should filter by date", async () => {
    let begin = new Date(today.setHours(0));
    let end = new Date(today.setHours(23, 59, 59, 999));

    const response = await request.get("/webhook/logs", {
      begin: begin.toISOString(),
      end: end.toISOString()
    });

    expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
    expect(response.body).toEqual([
      {
        _id: logIds[0].toHexString(),
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
        webhook: "test_webhook_id",
        created_at: created_at.toISOString()
      }
    ]);
  });

  it("should delete specific log", async () => {
    const response = await request.delete(`/webhook/logs/${logIds[0].toHexString()}`);
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
