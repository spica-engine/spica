import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {SchemaModule} from "../../../../../../libs/core/schema";
import {CoreTestingModule, Request} from "../../../../../../libs/core/testing";
import {DatabaseService, DatabaseTestingModule, ObjectId} from "../../../../../../libs/database/testing";
import {WebhookService} from "..";
import {Webhook} from "../../../../../../libs/interface/function/webhook";
import {SchemaResolver} from "../src/schema";
import {WebhookController} from "../src/webhook.controller";
import {PassportTestingModule} from "../../../passport/testing";
import {WebhookInvoker} from "../src/invoker";
import {WebhookLogService} from "../src/log.service";
import {WEBHOOK_OPTIONS} from "../../../../../../libs/interface/function/webhook";

describe("Webhook Controller", () => {
  let app: INestApplication;
  let req: Request;
  let module: TestingModule;
  let webhook: Webhook;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.replicaSet(),
        CoreTestingModule,
        PassportTestingModule.initialize(),
        SchemaModule.forChild()
      ],
      controllers: [WebhookController],
      providers: [
        WebhookService,
        SchemaResolver,
        WebhookInvoker,
        WebhookLogService,
        {provide: WEBHOOK_OPTIONS, useValue: {expireAfterSeconds: 60}}
      ]
    }).compile();
    module.enableShutdownHooks();
    req = module.get(Request);
    app = module.createNestApplication();
    req.reject = true;
    await app.listen(req.socket);

    const db = module.get(DatabaseService);
    await db.createCollection("coll1");
    await db.createCollection("coll2");

    webhook = {
      title: "wh1",
      url: "https://spica.internal",
      body: "",
      trigger: {
        name: "database",
        options: {
          collection: "coll1",
          type: "INSERT"
        }
      }
    };
  });

  afterEach(async () => await app.close());

  it("should list webhooks", async () => {
    const {body: hooks} = await req.get("/webhook", {});
    expect(hooks).toEqual({
      meta: {total: 0},
      data: []
    });
  });

  it("should insert a new webhook", async () => {
    const {body: hook} = await req.post("/webhook", webhook);

    const expected = {
      ...webhook,
      _id: hook._id
    };
    expected.trigger.active = true;

    expect(ObjectId.isValid(expected._id)).toEqual(true);
    expect(hook).toEqual(expected);
  });

  it("should update existing webhook", async () => {
    const {body: hook} = await req.post("/webhook", webhook);

    const body = {...hook, title: "wh2"};
    const id = body._id;
    delete body._id;

    const {body: updatedHook} = await req.put(`/webhook/${id}`, body);

    expect(updatedHook).toEqual({...hook, title: "wh2"});
  });

  it("should delete existing webhook", async () => {
    const {body: hook} = await req.post("/webhook", webhook);

    const result = await req.delete(`/webhook/${hook._id}`);

    expect(result.body).not.toBeTruthy();
    expect(result.statusCode).toBe(204);
  });

  it("should show existing webhook", async () => {
    const {body: hook} = await req.post("/webhook", webhook);

    const {body: existingWebhook} = await req.get(`/webhook/${hook._id}`, undefined);
    expect(existingWebhook).toEqual(hook);
  });

  it("should list collections", async () => {
    const {body: collections} = await req.get("/webhook/collections", undefined);
    expect(collections.map(c => c.id).sort((a, b) => a.localeCompare(b))).toEqual([
      "coll1",
      "coll2",
      "webhook_logs"
    ]);
    expect(collections.map(c => c.slug).sort((a, b) => a.localeCompare(b))).toEqual([
      "coll1",
      "coll2",
      "webhook_logs"
    ]);
  });

  describe("validation", () => {
    it("should report if the collection does not exist", async () => {
      webhook.trigger.options.collection = "collection_that_does_not_exist";

      const {body: validationErrors} = await req.post("/webhook", webhook).catch(e => e);
      expect(validationErrors.statusCode).toBe(400);
      expect(validationErrors.error).toBe("validation failed");
      expect(validationErrors.message).toBe(
        ".trigger.options.collection must be equal to one of the allowed values"
      );
    });

    it("should report if body is missing", async () => {
      delete webhook.body;

      const {body: validationErrors} = await req.post("/webhook", webhook).catch(e => e);
      expect(validationErrors.statusCode).toBe(400);
      expect(validationErrors.error).toBe("validation failed");
      expect(validationErrors.message).toBe(" must have required property 'body'");
    });

    it("should report if compilation failed for insert", async () => {
      webhook.body = "{{invali_body}";

      const {body: validationErrors} = await req.post("/webhook", webhook).catch(e => e);
      expect(validationErrors.statusCode).toBe(400);
      expect(validationErrors.error).toBe("Bad Request");
      expect(validationErrors.message.startsWith("Error: Parse error")).toEqual(true);
    });

    it("should report if compilation failed for update", async () => {
      const {body: insertedWh} = await req.post("/webhook", webhook);

      insertedWh.body = "{{invali_body}";
      const id = insertedWh._id;
      delete insertedWh._id;

      const {body: validationErrors} = await req.put(`/webhook/${id}`, insertedWh).catch(e => e);
      expect(validationErrors.statusCode).toBe(400);
      expect(validationErrors.error).toBe("Bad Request");
      expect(validationErrors.message.startsWith("Error: Parse error")).toEqual(true);
    });
  });
});
