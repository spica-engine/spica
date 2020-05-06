import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseService, DatabaseTestingModule, stream} from "@spica-server/database/testing";
import {WebhookService} from "@spica-server/function/webhook";
import {WebhookInvoker} from "@spica-server/function/webhook/src/invoker";
import {WebhookLogService} from "@spica-server/function/webhook/src/log.service";
import * as __fetch__ from "node-fetch";

const FULL_CHANGE_TEMPLATE = "{{{toJSON this}}}";

describe("Webhook Invoker", () => {
  let invoker: WebhookInvoker;
  let module: TestingModule;
  let service: WebhookService;
  let db: DatabaseService;

  let subscribeSpy: jasmine.Spy<typeof invoker["subscribe"]>;
  let unsubscribeSpy: jasmine.Spy<typeof invoker["unsubscribe"]>;
  let fetchSpy: jasmine.Spy<typeof __fetch__.default>;

  let mockHttpResponse = {
    headers: {
      raw: () => {
        return {key: ["value"]};
      }
    },
    status: 404,
    statusText: "Not Found",
    text: () => Promise.resolve("res_body")
  } as any;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet()],
      providers: [WebhookInvoker, WebhookService, WebhookLogService]
    }).compile();

    service = module.get(WebhookService);
    db = module.get(DatabaseService);

    invoker = module.get(WebhookInvoker);
    await stream.wait();

    subscribeSpy = spyOn(invoker, "subscribe" as never).and.callThrough();
    unsubscribeSpy = spyOn(invoker, "unsubscribe" as never).and.callThrough();
    fetchSpy = spyOn(__fetch__, "default").and.returnValue(Promise.resolve(mockHttpResponse));
  }, 20000);

  afterEach(async () => await module.close());

  it("should subscribe and open a change stream against the collection", async () => {
    const {_id, ...hook} = await service.insertOne({
      url: "http://spica.internal",
      body: "",
      trigger: {
        name: "database",
        active: true,
        options: {
          collection: "stream_coll",
          type: "INSERT"
        }
      }
    });
    await stream.change.wait();
    const subsequentStream = await stream.wait();
    expect(subscribeSpy).toHaveBeenCalledTimes(1);
    expect(subscribeSpy).toHaveBeenCalledWith(_id.toHexString(), hook);
    expect(subsequentStream).toEqual([
      "stream_coll",
      [
        {
          $match: {operationType: "insert"}
        }
      ],
      {fullDocument: "updateLookup"}
    ]);
  });

  it("should unsubscribe after the webhook has deleted", async () => {
    const hook = await service.insertOne({
      url: "http://spica.internal",
      body: "",
      trigger: {
        name: "database",
        active: true,
        options: {
          collection: "stream_coll",
          type: "INSERT"
        }
      }
    });
    await stream.change.wait();
    await service.deleteOne({_id: hook._id});
    await stream.change.wait();
    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    expect(unsubscribeSpy).toHaveBeenCalledWith(hook._id.toHexString());
  });

  it("should unsubscribe after the webhook has disabled", async () => {
    const hook = await service.insertOne({
      url: "http://spica.internal",
      body: FULL_CHANGE_TEMPLATE,
      trigger: {
        name: "database",
        active: true,
        options: {
          collection: "stream_coll",
          type: "INSERT"
        }
      }
    });
    await stream.change.wait();
    await service.updateOne({_id: hook._id}, {$unset: {"trigger.active": ""}});
    await stream.change.wait();
    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    expect(unsubscribeSpy).toHaveBeenCalledWith(hook._id.toHexString());
  });

  it("should report changes from the database", async () => {
    await service.insertOne({
      url: "http://spica.internal",
      body: FULL_CHANGE_TEMPLATE,
      trigger: {
        name: "database",
        active: true,
        options: {
          collection: "stream_coll",
          type: "INSERT"
        }
      }
    });
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
    await service.insertOne({
      url: "http://spica.internal",
      body: "{{{toJSON document}}}",
      trigger: {
        name: "database",
        active: true,
        options: {
          collection: "stream_coll",
          type: "INSERT"
        }
      }
    });
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
    const insertLog = spyOn(invoker["logService"], "insertOne");
    const hook = await service.insertOne({
      url: "http://spica.internal",
      body: FULL_CHANGE_TEMPLATE,
      trigger: {
        name: "database",
        active: true,
        options: {
          collection: "stream_coll",
          type: "INSERT"
        }
      }
    });
    await stream.change.wait();
    stream.change.next();
    const doc = await db.collection("stream_coll").insertOne({doc: "fromdb"});
    await stream.change.wait();

    expect(insertLog).toHaveBeenCalledTimes(1);
    expect(insertLog).toHaveBeenCalledWith({
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
      },
      webhook: hook._id.toHexString()
    });
  });
});
