import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseService, DatabaseTestingModule, stream} from "@spica-server/database/testing";
import {Webhook, WebhookService, WEBHOOK_OPTIONS} from "@spica-server/function/webhook";
import {WebhookInvoker} from "@spica-server/function/webhook/src/invoker";
import {WebhookLogService} from "@spica-server/function/webhook/src/log.service";
import __fetch__ from "node-fetch";

jest.setTimeout(60_000);

describe("Webhook Invoker", () => {
  let invoker: WebhookInvoker;
  let module: TestingModule;
  let service: WebhookService;
  let db: DatabaseService;
  let logService: WebhookLogService;

  let subscribeSpy: jest.SpyInstance;
  let unsubscribeSpy: jest.SpyInstance;
  let fetchSpy: jest.SpyInstance;
  let insertLogSpy: jest.SpyInstance;

  let webhook: Webhook;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet()],
      providers: [
        WebhookInvoker,
        WebhookService,
        WebhookLogService,
        {
          provide: WEBHOOK_OPTIONS,
          useValue: {
            expireAfterSeconds: 5
          }
        }
      ]
    }).compile();
    module.enableShutdownHooks();
    service = module.get(WebhookService);
    db = module.get(DatabaseService);
    logService = module.get(WebhookLogService);
    invoker = module.get(WebhookInvoker);
    await stream.wait();

    subscribeSpy = jest.spyOn(invoker, "subscribe" as never);
    unsubscribeSpy = jest.spyOn(invoker, "unsubscribe" as never);

    const nodeFetch = {fetch: __fetch__};
    fetchSpy = jest.spyOn(nodeFetch, "fetch");
    insertLogSpy = jest.spyOn(logService, "insertOne" as never).mockImplementation();

    await new Promise(resolve => setTimeout(() => resolve(""), 2000));

    webhook = {
      title: "wh1",
      url: "http://spica.internal",
      body: "{{{toJSON this}}}",
      trigger: {
        name: "database",
        active: true,
        options: {
          collection: "stream_coll",
          type: "INSERT"
        }
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

  it("should subscribe and open a change stream against the collection", async () => {
    const {_id, ...hook} = await service.insertOne(webhook);
    await stream.change.wait();
    const subsequentStream = await stream.wait();
    expect(subscribeSpy).toHaveBeenCalledTimes(1);
    expect(subscribeSpy).toHaveBeenCalledWith(_id.toHexString(), hook);
    expect(subsequentStream[0]).toBe("stream_coll");
    expect(subsequentStream[1]).toEqual([
      {
        $match: {operationType: "insert"}
      }
    ]);
    expect(subsequentStream[2]["fullDocument"]).toBe("updateLookup");
  });

  it("should unsubscribe after the webhook has deleted", async () => {
    const hook = await service.insertOne(webhook);
    await stream.change.wait();
    await service.deleteOne({_id: hook._id});
    await stream.change.wait();
    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    expect(unsubscribeSpy).toHaveBeenCalledWith(hook._id.toHexString());
  });

  it("should unsubscribe after the webhook has disabled", async () => {
    const hook = await service.insertOne(webhook);
    await stream.change.wait();
    await service.updateOne({_id: hook._id}, {$unset: {"trigger.active": ""}});
    await stream.change.wait();
    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    expect(unsubscribeSpy).toHaveBeenCalledWith(hook._id.toHexString());
  });

  it("should report changes from the database", async () => {
    await service.insertOne(webhook);
    await stream.change.wait();
    stream.change.next();
    const doc = await db.collection("stream_coll").insertOne({doc: "fromdb"});
    await stream.change.wait();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith("http://spica.internal", {
      method: "post",
      body: JSON.stringify({
        type: "insert",
        document: {_id: doc.insertedId.toHexString(), doc: "fromdb"},
        documentKey: doc.insertedId.toHexString()
      }),
      headers: {
        "User-Agent": "Spica/Webhooks; (https://spicaengine.com/docs/guide/webhook)",
        "Content-type": "application/json"
      }
    });
  });

  it("should report changes from the database with mapping", async () => {
    webhook.body = "{{{toJSON document}}}";
    await service.insertOne(webhook);
    await stream.change.wait();
    stream.change.next();
    const doc = await db.collection("stream_coll").insertOne({doc: "fromdb"});
    await stream.change.wait();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith("http://spica.internal", {
      method: "post",
      body: JSON.stringify({_id: doc.insertedId.toHexString(), doc: "fromdb"}),
      headers: {
        "User-Agent": "Spica/Webhooks; (https://spicaengine.com/docs/guide/webhook)",
        "Content-type": "application/json"
      }
    });
  });

  it("should insert a log when hook has been invoked", async () => {
    const hook = await service.insertOne(webhook);
    await stream.change.wait();
    stream.change.next();
    const doc = await db.collection("stream_coll").insertOne({doc: "fromdb"});
    await stream.change.wait();

    expect(insertLogSpy).toHaveBeenCalledTimes(1);

    let expectedArg: any = insertLogSpy.mock.calls[0][0];
    expect(expectedArg.created_at).toEqual(expect.any(Date));
    delete expectedArg.created_at;
    expect(expectedArg).toEqual({
      content: {
        request: {
          body: JSON.stringify({
            type: "insert",
            document: {_id: doc.insertedId.toHexString(), doc: "fromdb"},
            documentKey: doc.insertedId.toHexString()
          }),
          headers: {
            "User-Agent": "Spica/Webhooks; (https://spicaengine.com/docs/guide/webhook)",
            "Content-type": "application/json"
          },
          url: "http://spica.internal"
        },
        response: {
          headers: {key: ["value"]},
          status: 404,
          statusText: "Not Found",
          body: "res_body"
        }
      },
      webhook: hook._id.toHexString(),
      succeed: false
    } as any);
  });

  it("should insert log when webhook body compilation failed", async () => {
    webhook.body = "{{{document.title}}}";
    const hook = await service.insertOne(webhook);
    await stream.change.wait();
    stream.change.next();
    const doc = await db.collection("stream_coll").insertOne({doc: "fromdb"});
    await stream.change.wait();

    expect(insertLogSpy).toHaveBeenCalledTimes(1);

    let expectedArg: any = insertLogSpy.mock.calls[0][0];
    expect(expectedArg.created_at).toEqual(expect.any(Date));
    delete expectedArg.created_at;
    expect(expectedArg).toEqual({
      content: {
        error: '"title" not defined in [object Object] - 1:3'
      },
      webhook: hook._id.toHexString(),
      succeed: false
    } as any);
  });
});
