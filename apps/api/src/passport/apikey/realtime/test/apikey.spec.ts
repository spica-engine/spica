import {ForbiddenException, INestApplication, UnauthorizedException} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request, Websocket} from "@spica-server/core/testing";
import {WsAdapter} from "@spica-server/core/websocket";
import {DatabaseTestingModule, ObjectId, stream} from "@spica-server/database/testing";
import {GuardService} from "@spica-server/passport/guard/services";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {OBJECTID_STRING, DATE_TIME, OBJECT_ID} from "@spica-server/core/schema/formats";
import {CREATED_AT, UPDATED_AT} from "@spica-server/core/schema/defaults";
import {ChunkKind} from "@spica-server/interface/realtime";
import {ApiKeyModule} from "@spica-server/passport/apikey";
import {ApiKey} from "@spica-server/interface/passport/apikey";

function url(query?: {[k: string]: string | number | boolean | object}) {
  const url = new URL("/passport/apikey", "ws://insteadof");
  for (const key in query) {
    url.searchParams.set(
      key,
      (typeof query[key] == "string" ? String(query[key]) : JSON.stringify(query[key])) as string
    );
  }
  return `${url.pathname}${url.search}`;
}

describe("Realtime", () => {
  let wsc: Websocket;
  let app: INestApplication;
  let req: Request;

  let apikeys: ApiKey[];

  let initialApikey: ApiKey;

  async function insertApikey(doc: ApiKey) {
    const {body} = await req.post("/passport/apikey", doc);
    return body;
  }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        SchemaModule.forRoot({
          formats: [OBJECT_ID, DATE_TIME, OBJECTID_STRING],
          defaults: [CREATED_AT, UPDATED_AT]
        }),
        DatabaseTestingModule.replicaSet(),
        CoreTestingModule,
        PreferenceTestingModule,
        ApiKeyModule.forRoot({
          realtime: true
        }),
        PassportTestingModule.initialize()
      ]
    }).compile();

    module.enableShutdownHooks();
    wsc = module.get(Websocket);
    req = module.get(Request);
    app = module.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.listen(wsc.socket);

    const postRes = await req.post("/passport/apikey", {name: "test", active: true, key: "test"});
    const putRes = await req.put(`/passport/apikey/${postRes.body._id}/policy/ApiKeyFullAccess`);
    initialApikey = putRes.body;
  });

  // afterEach(async () => {
  //   await app.close();
  // });

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
      const messageSpy = jest.fn();

      const ws = wsc.get("/passport/apikey", {
        headers: {
          Authorization: "APIKEY test"
        }
      });

      ws.onmessage = e => {
        messageSpy(JSON.parse(e.data as string));
        const lastMessage = JSON.stringify({kind: ChunkKind.EndOfInitial});

        if (e.data == lastMessage) {
          expect(messageSpy.mock.calls.map(c => c[0])).toEqual([
            {kind: ChunkKind.Initial, document: initialApikey},
            {kind: ChunkKind.EndOfInitial}
          ]);
          ws.close().then(() => done());
        }
      };
      ws.connect;
    });

    it("should show error messages", done => {
      authGuardCheck.mockImplementation(() => {
        throw new UnauthorizedException();
      });
      const ws = wsc.get("/passport/apikey", {
        headers: {
          Authorization: "APIKEY test"
        }
      });
      ws.onclose = () => done();
      ws.onmessage = e => {
        expect(e.data).toEqual(`{"kind":-1,"status":401,"message":"Unauthorized"}`);
      };
    });

    it("should the action error message", done => {
      actionGuardCheck.mockImplementation(() => {
        throw new ForbiddenException("You do not have sufficient permissions to do this action.");
      });
      const ws = wsc.get("/passport/apikey", {
        headers: {
          Authorization: "APIKEY test"
        }
      });
      ws.onclose = () => done();
      ws.onmessage = e => {
        expect(e.data).toEqual(
          `{"kind":-1,"status":403,"message":"You do not have sufficient permissions to do this action."}`
        );
      };
    });
  });

  describe("documents", () => {
    const messageSpy = jest.fn();

    beforeEach(async () => {
      apikeys = [
        await insertApikey({
          name: "apikey 1",
          key: "123",
          policies: undefined,
          active: true
        }),
        await insertApikey({
          name: "apikey 2",
          key: "456",
          policies: undefined,
          active: true
        })
      ];

      messageSpy.mockClear();
    });

    describe("initial sync", () => {
      const lastMessage = JSON.stringify({kind: ChunkKind.EndOfInitial});

      it("should do the initial sync", done => {
        const ws = wsc.get("/passport/apikey");

        ws.onmessage = async e => {
          messageSpy(JSON.parse(e.data as string));

          if (e.data == lastMessage) {
            expect(messageSpy.mock.calls.map(c => c[0])).toEqual([
              {kind: ChunkKind.Initial, document: initialApikey},
              {kind: ChunkKind.Initial, document: apikeys[0]},
              {kind: ChunkKind.Initial, document: apikeys[1]},
              {kind: ChunkKind.EndOfInitial}
            ]);

            await ws.close();
            done();
          }
        };

        ws.connect;
      });

      it("should do the initial sync with limit", done => {
        const ws = wsc.get(url({limit: 2}));

        ws.onmessage = async e => {
          messageSpy(JSON.parse(e.data as string));

          if (e.data == lastMessage) {
            expect(messageSpy.mock.calls.map(c => c[0])).toEqual([
              {kind: ChunkKind.Initial, document: initialApikey},
              {kind: ChunkKind.Initial, document: apikeys[0]},
              {kind: ChunkKind.EndOfInitial}
            ]);

            await ws.close();
            done();
          }
        };

        ws.connect;
      });

      it("should do the initial sync with skip", done => {
        const ws = wsc.get(url({skip: 2}));

        ws.onmessage = async e => {
          messageSpy(JSON.parse(e.data as string));

          if (e.data == lastMessage) {
            expect(messageSpy.mock.calls.map(c => c[0])).toEqual([
              {kind: ChunkKind.Initial, document: apikeys[1]},
              {kind: ChunkKind.EndOfInitial}
            ]);

            await ws.close();
            done();
          }
        };

        ws.connect;
      });

      it("should do the initial sync with skip and limit", done => {
        Promise.all([
          insertApikey({
            name: "apikey 3",
            key: "789",
            policies: undefined,
            active: true
          }),
          insertApikey({
            name: "apikey 4",
            key: "012",
            policies: undefined,
            active: true
          })
        ]).then(newApikey => {
          const ws = wsc.get(url({skip: 2, limit: 2}));

          ws.onmessage = async e => {
            messageSpy(JSON.parse(e.data as string));

            if (e.data == lastMessage) {
              expect(messageSpy.mock.calls.map(c => c[0])).toEqual([
                {kind: ChunkKind.Initial, document: apikeys[1]},
                {kind: ChunkKind.Initial, document: newApikey[0]},
                {kind: ChunkKind.EndOfInitial}
              ]);

              await ws.close();
              done();
            }
          };

          ws.connect;
        });
      });

      it("should do the initial sync with sort", done => {
        const ws = wsc.get(url({sort: {_id: -1}}));

        ws.onmessage = async e => {
          messageSpy(JSON.parse(e.data as string));

          if (e.data == lastMessage) {
            expect(messageSpy.mock.calls.map(c => c[0])).toEqual([
              {kind: ChunkKind.Initial, document: apikeys[1]},
              {kind: ChunkKind.Initial, document: apikeys[0]},
              {kind: ChunkKind.Initial, document: initialApikey},
              {kind: ChunkKind.EndOfInitial}
            ]);

            await ws.close();
            done();
          }
        };

        ws.connect;
      });
    });
  });
});
