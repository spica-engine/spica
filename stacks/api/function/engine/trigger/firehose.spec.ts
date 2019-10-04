import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Websocket} from "@spica-server/core/testing";
import {FirehoseClient, FirehosePool, FirehoseTrigger, FirehoseTriggerModule} from "./firehose";

describe("firehose trigger", () => {
  let app: INestApplication;
  let wsc: Websocket;
  let trigger: FirehoseTrigger;
  const noopTarget = {id: "_", handler: "_"};

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [CoreTestingModule, FirehoseTriggerModule]
    }).compile();

    app = module.createNestApplication();
    trigger = module.get(FirehoseTrigger);
    wsc = module.get(Websocket);
    await app.listen(wsc.socket);
  });

  afterAll(async () => await app.close());

  it("should trigger wildcard event when client connected and disconnected", done => {
    const spy = jasmine.createSpy("connect");
    const options = {event: "*"};
    trigger.register(spy, noopTarget, options);
    const ws = wsc.get("/firehose");
    ws.onopen = () =>
      setTimeout(() => {
        expect(spy).toHaveBeenCalledTimes(1);
        const [poolAndClient, event] = spy.calls.first().args[0].parameters;
        expect(poolAndClient.client instanceof FirehoseClient).toBe(true);
        expect(poolAndClient.pool instanceof FirehosePool).toBe(true);
        expect(poolAndClient.pool.size).toBe(1);
        expect(event).toEqual({name: "connection", data: undefined});
        spy.calls.reset();
        ws.close();
      }, 1);

    ws.onclose = () =>
      setTimeout(() => {
        expect(spy).toHaveBeenCalledTimes(1);
        const [poolAndClient, event] = spy.calls.first().args[0].parameters;
        expect(poolAndClient.client instanceof FirehoseClient).toBe(true);
        expect(poolAndClient.pool instanceof FirehosePool).toBe(true);
        expect(poolAndClient.pool.size).toBe(0);
        expect(event).toEqual({name: "close", data: undefined});
        trigger.register(null, noopTarget, options);
        done();
      }, 1);

    ws.onerror = e => done.fail(e.message);
  });

  it("should trigger for custom events", done => {
    const spy = jasmine.createSpy("customEvent");
    const options = {event: "customevent"};
    trigger.register(spy, noopTarget, options);
    const ws = wsc.get("/firehose");
    ws.onopen = () => {
      ws.send(JSON.stringify({name: "customevent", data: "mydata"}), err => {
        if (err) {
          done.fail(err);
        }
        setTimeout(() => {
          expect(spy).toHaveBeenCalledTimes(1);
          expect(spy.calls.first().args[0].parameters[1]).toEqual({
            name: "customevent",
            data: "mydata"
          });
          trigger.register(null, noopTarget, options);
          ws.close();
          done();
        }, 100);
      });
    };
    ws.onerror = e => done.fail(e.message);
  });
});
