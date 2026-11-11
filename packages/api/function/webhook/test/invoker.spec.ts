import {Test, TestingModule} from "@nestjs/testing";
import {provideRepository, idOf, omitId} from "@spica-server/data";
import {changeFeedReady, contractSuite} from "@spica-server/database-testing";
import {WebhookChangeDispatcher, WebhookService} from "@spica-server/function-webhook";
import {WebhookInvoker} from "@spica-server/function-webhook/src/invoker";
import {
  BUCKET_DATA_REPOSITORY,
  BUCKET_REPOSITORY,
  BUCKET_SCHEMA_MANAGER
} from "@spica-server/interface-bucket";
import {BUCKET_WRITE, BucketWriteFacade} from "@spica-server/interface-bucket-common";
import {
  WEBHOOK_LOG_REPOSITORY,
  WEBHOOK_OPTIONS,
  WEBHOOK_REPOSITORY,
  Webhook
} from "@spica-server/interface-function-webhook";
import __fetch__ from "node-fetch";

jest.setTimeout(60_000);

async function until(condition: () => boolean) {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > 20_000) {
      throw new Error("timed out waiting for the condition");
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const HEADERS = {
  "User-Agent": "Spica/Webhooks; (https://spicaengine.com/docs/guide/webhook)",
  "Content-type": "application/json"
};

let buckets = 0;

contractSuite("Webhook Invoker", engine => {
  const mongo = engine.name == "mongodb";
  const keyField = mongo ? "_id" : "id";
  let invoker: WebhookInvoker;
  let module: TestingModule;
  let service: WebhookService;
  let writes: BucketWriteFacade;
  let bucket: any;
  let collection: string;
  let logService: any;

  let subscribeSpy: jest.SpyInstance;
  let unsubscribeSpy: jest.SpyInstance;
  let fetchSpy: jest.SpyInstance;
  let insertLogSpy: jest.SpyInstance;

  let webhook: Webhook;

  const insert = (document: object) =>
    writes.insert(bucket, {...document}, {}, {resolveSchema: () => bucket, deleteOne: jest.fn()});

  const requestBody = (call = 0) => fetchSpy.mock.calls[call][1].body as string;

  const subscribed = async (hook: Webhook) => {
    const saved = await service.insert(hook);
    await until(() => subscribeSpy.mock.calls.length > 0);
    await changeFeedReady(module);
    return saved;
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [engine.module()],
      providers: [
        WebhookInvoker,
        provideRepository(WEBHOOK_REPOSITORY),
        WebhookService,
        WebhookChangeDispatcher,
        provideRepository(WEBHOOK_LOG_REPOSITORY),
        provideRepository(BUCKET_REPOSITORY),
        provideRepository(BUCKET_SCHEMA_MANAGER),
        provideRepository(BUCKET_DATA_REPOSITORY),
        {provide: WEBHOOK_OPTIONS, useValue: {expireAfterSeconds: 5}}
      ]
    }).compile();
    module.enableShutdownHooks();
    service = module.get(WebhookService);
    logService = module.get(WEBHOOK_LOG_REPOSITORY);
    invoker = module.get(WebhookInvoker);
    writes = module.get(BUCKET_WRITE);

    subscribeSpy = jest.spyOn(invoker, "subscribe" as never);
    unsubscribeSpy = jest.spyOn(invoker, "unsubscribe" as never);

    const nodeFetch = {fetch: __fetch__};
    fetchSpy = jest.spyOn(nodeFetch, "fetch");
    insertLogSpy = jest.spyOn(logService, "insert" as never).mockResolvedValue(undefined as never);

    bucket = await module.get(BUCKET_SCHEMA_MANAGER).create(
      {
        title: `webhook ${++buckets}`,
        description: "",
        icon: "",
        primary: mongo ? "doc" : "id",
        readOnly: false,
        history: false,
        order: 0,
        acl: {read: "true==true", write: "true==true"},
        properties: mongo
          ? {doc: {type: "string"}}
          : {id: {type: "uuid", options: {generated: true}}, doc: {type: "string"}}
      } as any,
      () => {}
    );
    collection = `bucket_${idOf(bucket)}`;

    webhook = {
      title: "wh1",
      url: "http://spica.internal",
      body: "{{{toJSON this}}}",
      trigger: {
        name: "database",
        active: true,
        options: {collection, type: "INSERT"}
      }
    };
  });

  afterEach(async () => {
    subscribeSpy.mockClear();
    unsubscribeSpy.mockClear();
    fetchSpy.mockClear();
    insertLogSpy.mockClear();

    await module.close();
  });

  it("should subscribe to the collection of the webhook", async () => {
    const stored = await subscribed(webhook);

    expect(subscribeSpy).toHaveBeenCalledTimes(1);
    expect(subscribeSpy).toHaveBeenCalledWith(String(idOf(stored)), omitId(stored));
  });

  it("should unsubscribe after the webhook has deleted", async () => {
    const hook = await subscribed(webhook);

    await service.deleteById(idOf(hook));
    await until(() => unsubscribeSpy.mock.calls.length > 0);

    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    expect(unsubscribeSpy).toHaveBeenCalledWith(String(idOf(hook)));
  });

  it("should unsubscribe after the webhook has disabled", async () => {
    const hook = await subscribed(webhook);

    await service.replaceById(idOf(hook), {
      ...webhook,
      trigger: {...webhook.trigger, active: false}
    });
    await until(() => unsubscribeSpy.mock.calls.length > 0);

    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    expect(unsubscribeSpy).toHaveBeenCalledWith(String(idOf(hook)));
  });

  it("should stop reporting changes after the webhook has deleted", async () => {
    const hook = await subscribed(webhook);
    await service.deleteById(idOf(hook));
    await until(() => unsubscribeSpy.mock.calls.length > 0);

    await insert({doc: "ignored"});
    await sleep(500);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("should report changes from the database", async () => {
    await subscribed(webhook);

    const saved = await insert({doc: "fromdb"});
    await until(() => fetchSpy.mock.calls.length > 0);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith("http://spica.internal", {
      method: "post",
      body: expect.any(String),
      headers: HEADERS
    });
    expect(JSON.parse(requestBody())).toEqual({
      type: "insert",
      document: expect.objectContaining({doc: "fromdb"}),
      documentKey: String(saved[keyField])
    });
  });

  it("should report changes from the database with mapping", async () => {
    webhook.body = "{{{toJSON document}}}";
    await subscribed(webhook);

    await insert({doc: "fromdb"});
    await until(() => fetchSpy.mock.calls.length > 0);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(requestBody())).toEqual(expect.objectContaining({doc: "fromdb"}));
  });

  it("should only report the type of change the webhook asks for", async () => {
    webhook.trigger.options.type = "DELETE";
    await subscribed(webhook);

    const saved = await insert({doc: "kept"});
    await sleep(500);
    expect(fetchSpy).not.toHaveBeenCalled();

    await writes.delete(
      bucket,
      String(saved[keyField]),
      {},
      {
        resolveSchema: () => bucket,
        deleteOne: jest.fn()
      }
    );
    await until(() => fetchSpy.mock.calls.length > 0);

    expect(JSON.parse(requestBody())).toMatchObject({
      type: "delete",
      documentKey: String(saved[keyField])
    });
  });

  it("should insert a log when hook has been invoked", async () => {
    const hook = await subscribed(webhook);

    await insert({doc: "fromdb"});
    await until(() => insertLogSpy.mock.calls.length > 0);

    expect(insertLogSpy).toHaveBeenCalledTimes(1);
    const logged: any = insertLogSpy.mock.calls[0][0];
    expect(logged.created_at).toEqual(expect.any(Date));
    expect(logged).toEqual({
      content: {
        request: {body: expect.any(String), headers: HEADERS, url: "http://spica.internal"},
        response: {
          headers: {key: ["value"]},
          status: 404,
          statusText: "Not Found",
          body: "res_body"
        }
      },
      webhook: String(idOf(hook)),
      succeed: false,
      created_at: expect.any(Date)
    });
  });

  it("should insert log when webhook body compilation failed", async () => {
    webhook.body = "{{{document.title}}}";
    const hook = await subscribed(webhook);

    await insert({doc: "fromdb"});
    await until(() => insertLogSpy.mock.calls.length > 0);

    expect(insertLogSpy).toHaveBeenCalledTimes(1);
    expect(insertLogSpy.mock.calls[0][0]).toEqual({
      content: {error: '"title" not defined in [object Object] - 1:3'},
      webhook: String(idOf(hook)),
      succeed: false,
      created_at: expect.any(Date)
    });
  });
});
