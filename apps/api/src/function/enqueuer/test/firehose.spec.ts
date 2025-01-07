import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Websocket} from "@spica-server/core/testing";
import {FirehoseEnqueuer} from "@spica-server/function/enqueuer";
import {EventQueue, FirehoseQueue} from "@spica-server/function/queue";
import {event, Firehose} from "@spica-server/function/queue/proto";

describe("FirehoseEnqueuer", () => {
  let eventQueue: {enqueue: jest.Mock};
  let firehoseQueue: {enqueue: jest.Mock};
  let noopTarget: event.Target;
  let firehoseEnqueuer: FirehoseEnqueuer;
  let app: INestApplication;
  let wsc: Websocket;

  let schedulerUnsubscriptionSpy: jest.Mock;

  beforeEach(async () => {
    eventQueue = {
      'enqueue': jest.fn()
    };
    firehoseQueue = {
      'enqueue': jest.fn()
    };

    noopTarget = new event.Target();
    noopTarget.cwd = "/tmp/fn1";
    noopTarget.handler = "default";

    const module = await Test.createTestingModule({
      imports: [CoreTestingModule]
    }).compile();
    app = module.createNestApplication();
    wsc = module.get(Websocket);
    await app.listen(wsc.socket);

    schedulerUnsubscriptionSpy = jest.fn();
    firehoseEnqueuer = new FirehoseEnqueuer(
      eventQueue as any,
      firehoseQueue as any,
      app.getHttpAdapter().getHttpServer(),
      schedulerUnsubscriptionSpy
    );
  });

  afterEach(() => {
    app.close();
  });

  it("should subscribe", () => {
    firehoseEnqueuer.subscribe(noopTarget, {event: "**"});

    expect(Array.from(firehoseEnqueuer["eventTargetPairs"])).toEqual([
      {
        name: "**",
        target: noopTarget
      }
    ]);
  });

  it("should unsubscribe", () => {
    firehoseEnqueuer.subscribe(noopTarget, {event: "*"});
    firehoseEnqueuer.subscribe(noopTarget, {event: "**"});

    const target2 = {...noopTarget, cwd: "/tmp/fn2"} as any;
    firehoseEnqueuer.subscribe(target2, {event: "**"});

    firehoseEnqueuer.unsubscribe(noopTarget);

    expect(Array.from(firehoseEnqueuer["eventTargetPairs"])).toEqual([
      {
        name: "**",
        target: target2
      }
    ]);

    expect(schedulerUnsubscriptionSpy).toHaveBeenCalledWith(target2.id);
  });

  it("should send client description", async () => {
    firehoseEnqueuer.subscribe(noopTarget, {event: "**"});

    const ws = wsc.get("/firehose");

    await ws.connect;

    expect(eventQueue.enqueue).toHaveBeenCalledTimes(1);
    expect(firehoseQueue.enqueue).toHaveBeenCalledTimes(1);

    const connection = firehoseQueue.enqueue.mock.calls[firehoseQueue.enqueue.mock.calls.length - 1][1];

    expect(connection instanceof Firehose.Message.Incoming).toBe(true);
    expect(connection.client.id).toBeTruthy();
    // Since the connection has been established over a unix socket,
    // the ip address does not appear in the client adress property.
    expect(connection.client.remoteAddress).toBe(undefined);
  });

  it("should send pool description", async () => {
    firehoseEnqueuer.subscribe(noopTarget, {event: "**"});

    const ws = wsc.get("/firehose");

    await ws.connect;

    const connection = firehoseQueue.enqueue.mock.calls[firehoseQueue.enqueue.mock.calls.length - 1][1];

    expect(connection instanceof Firehose.Message.Incoming).toBe(true);
    expect(connection.pool instanceof Firehose.PoolDescription).toBe(true);
    expect(connection.pool.size).toBe(1);
  });

  it("should send request url when connecting", async () => {
    firehoseEnqueuer.subscribe(noopTarget, {event: "**"});

    const ws = wsc.get("/firehose?token=idk");

    await ws.connect;

    const connection = firehoseQueue.enqueue.mock.calls[firehoseQueue.enqueue.mock.calls.length - 1][1];

    expect(connection instanceof Firehose.Message.Incoming).toBe(true);
    expect(connection.message instanceof Firehose.Message).toBe(true);
    expect(connection.message.data).toEqual('{"url":"/firehose?token=idk"}');
  });

  it("should enqueue `**` event when client has connected and disconnected", async () => {
    firehoseEnqueuer.subscribe(noopTarget, {event: "**"});

    const ws = wsc.get("/firehose");

    await ws.connect;

    expect(eventQueue.enqueue).toHaveBeenCalledTimes(1);
    expect(firehoseQueue.enqueue).toHaveBeenCalledTimes(1);

    const connection = firehoseQueue.enqueue.mock.calls[firehoseQueue.enqueue.mock.calls.length - 1][1];

    expect(connection instanceof Firehose.Message.Incoming).toBe(true);
    expect(connection.message.name).toBe("connection");
    // Test if we receive any other events
    await ws.send(JSON.stringify({name: "customevent", data: "mydata"}));

    await ws.close();

    const close = firehoseQueue.enqueue.mock.calls[firehoseQueue.enqueue.mock.calls.length - 1][1];

    expect(close instanceof Firehose.Message.Incoming).toBe(true);
    expect(close.client.id).toBe(connection.client.id);
    expect(close.message.name).toBe("close");
  });

  it("should enqueue * event when for custom events and connection events", async () => {
    firehoseEnqueuer.subscribe(noopTarget, {event: "*"});
    const ws = wsc.get("/firehose");
    await ws.connect;

    await ws.send(JSON.stringify({name: "customevent", data: "mydata"}));

    await ws.close();

    expect(eventQueue.enqueue).toHaveBeenCalledTimes(3);
    expect(firehoseQueue.enqueue).toHaveBeenCalledTimes(3);
    expect(firehoseQueue.enqueue.mock.calls[1][1].message.toObject()).toEqual({
      name: "customevent",
      data: '"mydata"'
    });
  });

  it("should enqueue custom events", async () => {
    firehoseEnqueuer.subscribe(noopTarget, {event: "customevent"});
    const ws = wsc.get("/firehose");
    await ws.connect;

    await ws.send(JSON.stringify({name: "customevent", data: "mydata"}));

    await ws.close();

    expect(eventQueue.enqueue).toHaveBeenCalledTimes(1);
    expect(firehoseQueue.enqueue).toHaveBeenCalledTimes(1);
    expect(firehoseQueue.enqueue.mock.calls[0][1].message.toObject()).toEqual({
      name: "customevent",
      data: '"mydata"'
    });
  });
});
