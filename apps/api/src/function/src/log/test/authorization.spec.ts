import {INestApplication, UnauthorizedException} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {LogModule} from "@spica/api/src/function/src/log";
import {CoreTestingModule, Websocket} from "@spica/core";
import {WsAdapter} from "@spica/core";
import {DatabaseTestingModule} from "@spica/database";
import {GuardService} from "@spica/api/src/passport";
import {PassportTestingModule} from "@spica/api/src/passport/testing";

describe("Realtime Authorization", () => {
  let wsc: Websocket;
  let app: INestApplication;
  let authGuardCheck: jasmine.Spy<typeof GuardService.prototype.checkAuthorization>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.replicaSet(),
        CoreTestingModule,
        LogModule.forRoot({expireAfterSeconds: 60, realtime: true}),
        PassportTestingModule.initialize({
          overriddenStrategyType: "JWT"
        })
      ]
    }).compile();
    wsc = module.get(Websocket);
    app = module.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.listen(wsc.socket);
    authGuardCheck = spyOn(module.get(GuardService), "checkAuthorization");
  });

  afterAll(() => app.close());

  beforeEach(() => {
    authGuardCheck.and.returnValue(Promise.resolve(true));
  });

  it("should authorize and do the initial sync", async done => {
    const ws = wsc.get("/function-logs", {
      headers: {
        Authorization: "JWT test"
      }
    });

    ws.onclose = done;
    ws.onmessage = e => {
      expect(e.data).toEqual(`{"kind":1}`);
    };
    await ws.connect;
    await ws.close();
  });

  it("should show error messages", done => {
    authGuardCheck.and.callFake(() => {
      throw new UnauthorizedException();
    });
    const ws = wsc.get("/function-logs", {
      headers: {
        Authorization: "JWT test"
      }
    });
    ws.onclose = done;
    ws.onmessage = e => {
      expect(e.data).toEqual(`{"code":401,"message":"Unauthorized"}`);
    };
  });
});
