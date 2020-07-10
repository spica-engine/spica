import {ForbiddenException, INestApplication, UnauthorizedException} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {RealtimeModule} from "@spica-server/bucket/realtime";
import {CoreTestingModule, Websocket} from "@spica-server/core/testing";
import {WsAdapter} from "@spica-server/core/websocket";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {ActionGuardService, AuthGuardService} from "@spica-server/passport";
import {PassportTestingModule} from "@spica-server/passport/testing";

describe("Realtime Authorization", () => {
  let wsc: Websocket;
  let app: INestApplication;
  let authGuardCheck: jasmine.Spy<typeof AuthGuardService.prototype.check>;
  let actionGuardCheck: jasmine.Spy<typeof ActionGuardService.prototype.check>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.replicaSet(),
        CoreTestingModule,
        RealtimeModule,
        PassportTestingModule.initialize({
          overriddenStrategyType: "APIKEY",
          skipActionCheck: false
        })
      ]
    }).compile();
    wsc = module.get(Websocket);
    app = module.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.listen(wsc.socket);
    authGuardCheck = spyOn(module.get(AuthGuardService), "check");
    actionGuardCheck = spyOn(module.get(ActionGuardService), "check");
  });

  afterAll(() => app.close());

  beforeEach(() => {
    actionGuardCheck.and.returnValue(Promise.resolve(true));
    authGuardCheck.and.returnValue(Promise.resolve(true));
  });

  it("should authorize and do the initial sync", async done => {
    const ws = wsc.get("/bucket/test/data", {
      headers: {
        Authorization: "APIKEY test"
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
    const ws = wsc.get("/bucket/test/data", {
      headers: {
        Authorization: "APIKEY test"
      }
    });
    ws.onclose = done;
    ws.onmessage = e => {
      expect(e.data).toEqual(`{"code":401,"message":"Unauthorized"}`);
    };
  });

  it("should the action error message", done => {
    actionGuardCheck.and.callFake(() => {
      throw new ForbiddenException("You do not have sufficient permissions to do this action.");
    });
    const ws = wsc.get("/bucket/test/data", {
      headers: {
        Authorization: "APIKEY test"
      }
    });
    ws.onclose = done;
    ws.onmessage = e => {
      expect(e.data).toEqual(
        `{"code":403,"message":"You do not have sufficient permissions to do this action."}`
      );
    };
  });
});
