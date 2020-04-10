import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {WebhookModule} from "..";
import {WebhookLogService} from "../src/log.service";

describe("Activity Acceptance", () => {
  let request: Request;
  let app: INestApplication;
  let service: WebhookLogService;
  let logIds: ObjectId[];
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.create(),
        CoreTestingModule,
        PassportTestingModule.initialize(),
        WebhookModule.forRoot()
      ]
    }).compile();

    request = module.get(Request);

    app = module.createNestApplication();

    await app.listen(request.socket);

    service = module.get(WebhookLogService);

    logIds = await service.insertMany([
      {
        request: {
          body: {test_key: "test_value"},
          headers: {test_key: "test_value"},
          path: "test_path"
        },
        response: {
          body: {test_key: "test_value"},
          headers: [{test_key: "test_value"}],
          status: 404,
          statusText: "BAD REQUEST"
        },
        webhook: "test_webhook_id"
      },
      {
        request: {
          body: {test_key: "test_value2"},
          headers: {test_key: "test_value2"},
          path: "test_path2"
        },
        response: {
          body: {test_key: "test_value2"},
          headers: [{test_key: "test_value2"}],
          status: 201,
          statusText: "CREATED"
        },
        webhook: "test_webhook_id2"
      }
    ]);
  });

  function objectIdToDate(id: string): Date {
    return new Date(parseInt(id.substring(0, 8), 16) * 1000);
  }

  it("should get all logs", async () => {
    const response = await request.get("/webhook/logs", {});

    expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
    expect(response.body).toEqual([
      {
        _id: logIds[0].toHexString(),
        request: {
          body: {test_key: "test_value"},
          headers: {test_key: "test_value"},
          path: "test_path"
        },
        response: {
          body: {test_key: "test_value"},
          headers: [{test_key: "test_value"}],
          status: 404,
          statusText: "BAD REQUEST"
        },
        webhook: "test_webhook_id"
      },
      {
        _id: logIds[1].toHexString(),
        request: {
          body: {test_key: "test_value2"},
          headers: {test_key: "test_value2"},
          path: "test_path2"
        },
        response: {
          body: {test_key: "test_value2"},
          headers: [{test_key: "test_value2"}],
          status: 201,
          statusText: "CREATED"
        },
        webhook: "test_webhook_id2"
      }
    ]);
  });

  it("should limit and skip", async () => {
    const response = await request.get("/webhook/logs", {skip: 1, limit: 1});

    expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
    expect(response.body).toEqual([
      {
        _id: logIds[1].toHexString(),
        request: {
          body: {test_key: "test_value2"},
          headers: {test_key: "test_value2"},
          path: "test_path2"
        },
        response: {
          body: {test_key: "test_value2"},
          headers: [{test_key: "test_value2"}],
          status: 201,
          statusText: "CREATED"
        },
        webhook: "test_webhook_id2"
      }
    ]);
  });

  it("should filter by webhook", async () => {
    const response = await request.get("/webhook/logs", {webhook: "test_webhook_id"});

    expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
    expect(response.body).toEqual([
      {
        _id: logIds[0].toHexString(),
        request: {
          body: {test_key: "test_value"},
          headers: {test_key: "test_value"},
          path: "test_path"
        },
        response: {
          body: {test_key: "test_value"},
          headers: [{test_key: "test_value"}],
          status: 404,
          statusText: "BAD REQUEST"
        },
        webhook: "test_webhook_id"
      }
    ]);
  });

  it("should filter by statusCode", async () => {
    const response = await request.get("/webhook/logs", {status: 201});

    expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
    expect(response.body).toEqual([
      {
        _id: logIds[1].toHexString(),
        request: {
          body: {test_key: "test_value2"},
          headers: {test_key: "test_value2"},
          path: "test_path2"
        },
        response: {
          body: {test_key: "test_value2"},
          headers: [{test_key: "test_value2"}],
          status: 201,
          statusText: "CREATED"
        },
        webhook: "test_webhook_id2"
      }
    ]);
  });

  it("should filter by date", async () => {
    const insertedId = await service
      .insertOne({
        _id: ObjectId.createFromTime(new Date(1990, 9, 9).getTime() / 1000),
        request: {
          body: {test_key: "test_value3"},
          headers: {test_key: "test_value3"},
          path: "test_path3"
        },
        response: {
          body: {test_key: "test_value3"},
          headers: [{test_key: "test_value3"}],
          status: 100,
          statusText: "TEST"
        },
        webhook: "test_webhook_id2"
      })
      //be sure it's inserted
      .then(res => {
        expect(res._id).toBeDefined();
        return res._id;
      });

    console.log(
      await service.find().then(res => res.map(res => objectIdToDate(res._id.toHexString()))),
      "CURRENT DOCUMENTS"
    );

    let end = new Date(new Date().setTime(new Date().getTime() + 1000));
    let begin = new Date(2020, 2, 2);

    console.log(end, "END", begin, "BEGIN");

    const response = await request.get("/webhook/logs", {begin, end});

    expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
    expect(response.body).toEqual([
      {
        _id: logIds[0].toHexString(),
        request: {
          body: {test_key: "test_value"},
          headers: {test_key: "test_value"},
          path: "test_path"
        },
        response: {
          body: {test_key: "test_value"},
          headers: [{test_key: "test_value"}],
          status: 404,
          statusText: "BAD REQUEST"
        },
        webhook: "test_webhook_id"
      },
      {
        _id: logIds[1].toHexString(),
        request: {
          body: {test_key: "test_value2"},
          headers: {test_key: "test_value2"},
          path: "test_path2"
        },
        response: {
          body: {test_key: "test_value2"},
          headers: [{test_key: "test_value2"}],
          status: 201,
          statusText: "CREATED"
        },
        webhook: "test_webhook_id2"
      }
    ]);
  });

  afterAll(async () => {
    await app.close();
  });
});
