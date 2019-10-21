import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Websocket} from "@spica-server/core/testing";
import {FirehoseClient, FirehosePool, FirehoseTrigger, FirehoseTriggerModule} from "./firehose";

describe("firehose trigger", () => {
  let app: INestApplication;
  let wsc: Websocket;
  let trigger: FirehoseTrigger;
  const noopTarget = {id: "_", handler: "_"};

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [CoreTestingModule, FirehoseTriggerModule]
    }).compile();

    app = module.createNestApplication();
    trigger = module.get(FirehoseTrigger);
    wsc = module.get(Websocket);
    await app.listen(wsc.socket);
  });

  afterEach(async () => await app.close());

  it("should trigger ** event when client connected and disconnected", async () => {
    const spy = jasmine.createSpy("connect");
    const options = {event: "**"};
    trigger.register(spy, noopTarget, options);
    const ws = wsc.get("/firehose");

    await ws.connect;

    expect(spy).toHaveBeenCalledTimes(1);
    let [poolAndClient, event] = spy.calls.first().args[0].parameters;
    expect(poolAndClient.client instanceof FirehoseClient).toBe(true);
    expect(poolAndClient.pool instanceof FirehosePool).toBe(true);
    expect(poolAndClient.pool.size).toBe(1);
    expect(event.name).toEqual("connection");
    expect(event.request.url).toEqual("/firehose");
    expect(event.request.headers.host).toEqual("localhost");

    // Test if we receive any other events
    await ws.send(JSON.stringify({name: "customevent", data: "mydata"}));

    await ws.close();

    expect(spy).toHaveBeenCalledTimes(2);
    [poolAndClient, event] = spy.calls.mostRecent().args[0].parameters;
    expect(poolAndClient.client instanceof FirehoseClient).toBe(true);
    expect(poolAndClient.pool instanceof FirehosePool).toBe(true);
    expect(poolAndClient.pool.size).toBe(0);
    expect(event).toEqual({name: "close", data: undefined});
  });

  it("should trigger * event when for custom events and connection events", async () => {
    const spy = jasmine.createSpy("wildcard");
    const options = {event: "*"};
    trigger.register(spy, noopTarget, options);
    const ws = wsc.get("/firehose");
    await ws.connect;

    await ws.send(JSON.stringify({name: "customevent", data: "mydata"}));

    await ws.close();

    expect(spy).toHaveBeenCalledTimes(3);
    expect(spy.calls.argsFor(1)[0].parameters[1]).toEqual({
      name: "customevent",
      data: "mydata"
    });
  });

  it("should trigger for custom events", async () => {
    const spy = jasmine.createSpy("customEvent");
    const options = {event: "customevent"};
    trigger.register(spy, noopTarget, options);
    const ws = wsc.get("/firehose");
    await ws.connect;
    await ws.send(JSON.stringify({name: "customevent", data: "mydata"}));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.calls.first().args[0].parameters[1]).toEqual({
      name: "customevent",
      data: "mydata"
    });
  });

  it("should be able to disconnect user", done => {
    const spy = jasmine
      .createSpy("connection", ({parameters: [{client}]}) => client.close())
      .and.callThrough();
    const options = {event: "connection"};
    trigger.register(spy, noopTarget, options);
    const ws = wsc.get("/firehose");
    ws.onclose = () => {
      expect(spy).toHaveBeenCalledTimes(1);
      done();
    };
  });
});
