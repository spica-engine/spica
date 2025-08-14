import {ForbiddenException, INestApplication, UnauthorizedException} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Websocket} from "@spica-server/core/testing";
import {WsAdapter} from "@spica-server/core/websocket";
import {DatabaseService, DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {ChunkKind} from "@spica-server/interface/realtime";
import {DashboardRealtimeModule} from "../src";
import {GuardService} from "@spica-server/passport/guard/services";

function url(path: string, query?: {[k: string]: string | string[]}) {
  const url = new URL(path, "ws://insteadof");
  for (const key in query) {
    const value = query[key];
    if (Array.isArray(value)) {
      value.forEach(v => url.searchParams.append(key, v));
    } else {
      url.searchParams.set(key, value);
    }
  }
  return `${url.pathname}${url.search}`;
}

describe("Dashboard Realtime", () => {
  let wsc: Websocket;
  let app: INestApplication;
  let db: DatabaseService;
  let rows: object[];

  let dashboardId1 = new ObjectId();
  let dashboardId2 = new ObjectId();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.replicaSet(),
        CoreTestingModule,
        PassportTestingModule.initialize({
          overriddenStrategyType: "APIKEY"
        }),
        DashboardRealtimeModule.register()
      ]
    }).compile();
    module.enableShutdownHooks();
    db = module.get(DatabaseService);
    wsc = module.get(Websocket);
    app = module.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.listen(wsc.socket);

    await new Promise<void>(resolve => setTimeout(() => resolve(), 2000));
  });

  afterAll(() => app.close());

  describe("authorization", () => {
    let authGuardCheck: jest.SpyInstance<
      Promise<boolean>,
      [
        {
          request: any;
          response: any;
          type?: string;
        }
      ],
      any
    >;
    let actionGuardCheck: jest.SpyInstance<
      Promise<boolean>,
      [
        {
          request: any;
          response: any;
          actions: string | string[];
        }
      ],
      any
    >;

    beforeEach(() => {
      const guardService = app.get(GuardService);
      authGuardCheck = jest.spyOn(guardService, "checkAuthorization");
      actionGuardCheck = jest.spyOn(guardService, "checkAction").mockImplementation(({request}) => {
        request.resourceFilter = {
          include: [],
          exclude: []
        };
        return Promise.resolve(true);
      });
    });

    it("should authorize and do the initial sync", done => {
      const ws = wsc.get("/dashboard", {
        headers: {
          Authorization: "APIKEY test"
        }
      });

      ws.onmessage = e => {
        expect(e.data).toEqual(`{"kind":1}`);
        ws.close().then(() => done());
      };
      ws.connect;
    });

    it("should show unauthorized messages", done => {
      authGuardCheck.mockImplementation(() => {
        throw new UnauthorizedException();
      });
      const ws = wsc.get("/dashboard", {
        headers: {
          Authorization: "APIKEY test"
        }
      });
      ws.onclose = () => done();
      ws.onmessage = e => {
        expect(e.data).toEqual(`{"kind":-1,"status":401,"message":"Unauthorized"}`);
      };
    });
  });

  describe("documents", () => {
    beforeEach(async () => {
      const guardService = app.get(GuardService);
      jest.spyOn(guardService, "checkAuthorization").mockResolvedValue(true);
      jest.spyOn(guardService, "checkAction").mockImplementation(({request}) => {
        request.resourceFilter = {include: [], exclude: []};
        return Promise.resolve(true);
      });

      const insertData = [
        {
          _id: dashboardId1,
          name: "Tests",
          icon: "leaderboard",
          components: [
            {
              name: "TestComp",
              url: "ozikotest.com",
              type: "pie",
              ratio: "2/2"
            }
          ]
        },
        {
          _id: dashboardId2,
          name: "Test2",
          icon: "leaderboard",
          components: [
            {
              name: "Bazingaaa",
              url: "zamazingo.com",
              type: "pie",
              ratio: "2/2"
            }
          ]
        }
      ];
      rows = await db
        .collection("dashboard")
        .insertMany(insertData)
        .then(r =>
          insertData.map((data, index) => ({
            ...data,
            _id: r.insertedIds[index].toString()
          }))
        );
    });

    afterEach(async () => {
      await db.collection("dashboard").drop();
    });

    it("should do the initial sync", async () => {
      const ws = wsc.get("/dashboard", {
        headers: {
          Authorization: "APIKEY test"
        }
      });
      const message = jest.fn();
      ws.onmessage = e => message(JSON.parse(e.data as string));
      await ws.connect;
      await ws.close();
      expect(message.mock.calls.map(c => c[0])).toEqual([
        {kind: ChunkKind.Initial, document: rows[0]},
        {kind: ChunkKind.Initial, document: rows[1]},
        {kind: ChunkKind.EndOfInitial}
      ]);
    });
  });
});
