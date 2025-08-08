import {INestApplication, UnauthorizedException} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {LogModule} from "..";
import {CoreTestingModule, Websocket} from "../../../../../../libs/core/testing";
import {WsAdapter} from "../../../../../../libs/core/websocket";
import {DatabaseTestingModule} from "../../../../../../libs/database/testing";
import {GuardService} from "../../../passport";
import {PassportTestingModule} from "../../../passport/testing";

describe("Realtime Authorization", () => {
  let wsc: Websocket;
  let app: INestApplication;
  let authGuardCheck: jest.SpyInstance<Promise<boolean>>;

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
    authGuardCheck = jest.spyOn(module.get(GuardService), "checkAuthorization");
  });

  afterAll(() => app.close());

  beforeEach(() => {
    authGuardCheck.mockReturnValue(Promise.resolve(true));
  });

  it("should authorize and do the initial sync", done => {
    const ws = wsc.get("/function-logs", {
      headers: {
        Authorization: "JWT test"
      }
    });

    ws.onclose = () => done();
    ws.onmessage = e => {
      expect(e.data).toEqual(`{"kind":1}`);
    };
    ws.connect.then(() => ws.close());
  });

  it("should show error messages", done => {
    authGuardCheck.mockImplementation(() => {
      throw new UnauthorizedException();
    });
    const ws = wsc.get("/function-logs", {
      headers: {
        Authorization: "JWT test"
      }
    });
    ws.onclose = () => done();
    ws.onmessage = e => {
      expect(e.data).toEqual(`{"code":401,"message":"Unauthorized"}`);
    };
  });
});
