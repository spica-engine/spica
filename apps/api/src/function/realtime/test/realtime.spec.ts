import {ForbiddenException, INestApplication, UnauthorizedException} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Websocket} from "@spica-server/core/testing";
import {WsAdapter} from "@spica-server/core/websocket";
import {DatabaseService, DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {ChunkKind} from "@spica-server/interface/realtime";
import {FunctionRealtimeModule} from "../src";
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

describe("Function Realtime", () => {
  let wsc: Websocket;
  let app: INestApplication;
  let db: DatabaseService;
  let rows: object[];

  let functionId1 = new ObjectId();
  let functionId2 = new ObjectId();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.replicaSet(),
        CoreTestingModule,
        PassportTestingModule.initialize({
          overriddenStrategyType: "APIKEY"
        }),
        FunctionRealtimeModule.register()
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
      const ws = wsc.get("/function", {
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
      const ws = wsc.get("/function", {
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
      const insertData = [
        {
          _id: functionId1,
          name: "test-function-1",
          description: "Test function 1",
          language: "javascript",
          timeout: 60
        },
        {
          _id: functionId2,
          name: "test-function-2",
          description: "Test function 2",
          language: "javascript",
          timeout: 12
        }
      ];
      rows = await db
        .collection("function")
        .insertMany(insertData)
        .then(r =>
          insertData.map((data, index) => ({
            ...data,
            _id: r.insertedIds[index].toString()
          }))
        );
    });

    afterEach(async () => {
      await db.collection("function").drop();
    });

    it("should do the initial sync", async () => {
      const ws = wsc.get(url("/function"));
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

    it("should work with filter", async () => {
      const filter = JSON.stringify({name: "test-function-1"});
      const ws = wsc.get(url("/function", {filter: filter}));
      const message = jest.fn();
      ws.onmessage = e => message(JSON.parse(e.data as string));
      await ws.connect;
      await ws.close();
      expect(message.mock.calls.map(c => c[0])).toEqual([
        {kind: ChunkKind.Initial, document: rows[0]},
        {kind: ChunkKind.EndOfInitial}
      ]);
    });

    it("should return only EndOfInitial when filter matches no function", async () => {
      const filter = JSON.stringify({name: "test-function-invalid"});
      const ws = wsc.get(url("/function", {filter}));
      const message = jest.fn();

      ws.onmessage = e => message(JSON.parse(e.data as string));

      await ws.connect;
      await new Promise(resolve => setTimeout(resolve, 100));
      await ws.close();

      expect(message.mock.calls.map(c => c[0])).toEqual([{kind: ChunkKind.EndOfInitial}]);
    });
  });
});
