import {ForbiddenException, INestApplication, UnauthorizedException} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request, Websocket} from "@spica-server/core-testing";
import {WsAdapter} from "@spica-server/core-websocket";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {GuardService} from "@spica-server/passport-guard-services";
import {PassportTestingModule} from "@spica-server/passport-testing";
import {ChunkKind} from "@spica-server/interface/realtime";
import {SecretModule} from "@spica-server/secret";
import {SchemaModule} from "@spica-server/core-schema";
import {OBJECT_ID, OBJECTID_STRING} from "@spica-server/core-schema";

function url(path: string, query: Record<string, string> = {}) {
  const u = new URL(path, "ws://insteadof");
  for (const key in query) {
    u.searchParams.set(key, query[key]);
  }
  return `${u.pathname}${u.search}`;
}

describe("Secret Realtime", () => {
  let wsc: Websocket;
  let app: INestApplication;
  let req: Request;

  async function insertSecret(doc: {key: string; value: string}) {
    const {body} = await req.post("/secret", doc);
    return body;
  }

  function connectSocket({
    query = {},
    headers = {}
  }: {query?: Record<string, string>; headers?: Record<string, string>} = {}) {
    return wsc.get(url("/secret", query), {headers});
  }

  function waitForOpen(socket: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("WebSocket did not open in time")), 5000);
      if (socket.connected) return resolve();

      socket.onopen = () => {
        clearTimeout(timeout);
        resolve();
      };

      socket.connect;
    });
  }

  function collectMessages(socket: any): Promise<any[]> {
    const messages: any[] = [];
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.onclose = () => resolve(messages);
        socket.close();
      }, 500);

      socket.onmessage = e => {
        try {
          messages.push(JSON.parse(e.data));
        } catch (err) {
          clearTimeout(timeout);
          reject(err);
        }
      };
    });
  }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        SchemaModule.forRoot({formats: [OBJECT_ID, OBJECTID_STRING]}),
        DatabaseTestingModule.replicaSet(),
        CoreTestingModule,
        SecretModule.forRoot({
          realtime: true,
          encryptionSecret: "test-encryption-secret-32chars!!"
        }),
        PassportTestingModule.initialize({overriddenStrategyType: "APIKEY"})
      ]
    }).compile();

    module.enableShutdownHooks();
    wsc = module.get(Websocket);
    req = module.get(Request);
    app = module.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.listen(wsc.socket);
  });

  afterEach(async () => await app.close());

  describe("authorization", () => {
    let authGuardCheck: jest.SpyInstance;
    let actionGuardCheck: jest.SpyInstance;

    beforeEach(() => {
      const guardService = app.get(GuardService);
      authGuardCheck = jest.spyOn(guardService, "checkAuthentication");
      actionGuardCheck = jest
        .spyOn(guardService, "checkAuthorization")
        .mockImplementation(({request}: {request: any}) => {
          request.resourceFilter = {include: [], exclude: []};
          return Promise.resolve(true);
        });
    });

    it("should authorize and do the initial sync", done => {
      const ws = wsc.get("/secret", {
        headers: {Authorization: "APIKEY test"}
      });

      ws.onmessage = e => {
        expect(e.data).toEqual(`{"kind":1}`);
        ws.close().then(() => done());
      };

      ws.connect;
    });

    it("should show error messages on unauthorized", done => {
      authGuardCheck.mockImplementation(() => {
        throw new UnauthorizedException();
      });

      const ws = wsc.get("/secret", {
        headers: {Authorization: "APIKEY test"}
      });

      ws.onclose = () => done();
      ws.onmessage = e => {
        expect(e.data).toEqual(`{"kind":-1,"status":401,"message":"Unauthorized"}`);
      };
    });

    it("should display the action error message", done => {
      actionGuardCheck.mockImplementation(() => {
        throw new ForbiddenException("You do not have sufficient permissions to do this action.");
      });

      const ws = wsc.get("/secret", {
        headers: {Authorization: "APIKEY test"}
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

    describe("with setup data", () => {
      let secrets: any[];

      beforeEach(async () => {
        secrets = [
          await insertSecret({key: "SECRET_KEY_1", value: "val1"}),
          await insertSecret({key: "SECRET_KEY_2", value: "val2"})
        ];

        messageSpy.mockClear();
      });

      describe("initial sync", () => {
        const lastMessage = JSON.stringify({kind: ChunkKind.EndOfInitial});

        it("should do the initial sync", done => {
          const ws = wsc.get("/secret");

          ws.onmessage = async e => {
            const data = e.data.toString();
            messageSpy(JSON.parse(data));

            if (data === lastMessage) {
              const calls = messageSpy.mock.calls.map(c => c[0]);
              expect(calls).toEqual([
                {
                  kind: ChunkKind.Initial,
                  document: expect.objectContaining({_id: secrets[0]._id, key: secrets[0].key})
                },
                {
                  kind: ChunkKind.Initial,
                  document: expect.objectContaining({_id: secrets[1]._id, key: secrets[1].key})
                },
                {kind: ChunkKind.EndOfInitial}
              ]);

              const docs = calls.filter(c => c.document).map(c => c.document);
              for (const doc of docs) {
                expect(doc).not.toHaveProperty("value");
              }

              await ws.close();
              done();
            }
          };

          ws.connect;
        });
      });

      describe("listening changes", () => {
        const lastMessage = JSON.stringify({kind: ChunkKind.EndOfInitial});

        it("should listen for insert changes", done => {
          const ws = wsc.get("/secret");

          let inserted = false;
          ws.onmessage = async e => {
            const data = e.data.toString();
            messageSpy(JSON.parse(data));

            if (data === lastMessage && !inserted) {
              inserted = true;
              await insertSecret({key: "SECRET_KEY_3", value: "val3"});
              return;
            }

            if (inserted) {
              const msg = JSON.parse(data);
              if (msg.kind === ChunkKind.Insert) {
                const calls = messageSpy.mock.calls.map(c => c[0]);
                expect(calls).toEqual([
                  {
                    kind: ChunkKind.Initial,
                    document: expect.objectContaining({_id: secrets[0]._id, key: secrets[0].key})
                  },
                  {
                    kind: ChunkKind.Initial,
                    document: expect.objectContaining({_id: secrets[1]._id, key: secrets[1].key})
                  },
                  {kind: ChunkKind.EndOfInitial},
                  {kind: ChunkKind.Insert, document: expect.objectContaining({key: "SECRET_KEY_3"})}
                ]);

                const docs = calls.filter(c => c.document).map(c => c.document);
                for (const doc of docs) {
                  expect(doc).not.toHaveProperty("value");
                }

                await ws.close();
                done();
              }
            }
          };

          ws.connect;
        });
      });
    });

    describe("query operations", () => {
      beforeEach(() => {
        messageSpy.mockClear();
      });

      it("should perform 'limit' action", async () => {
        await insertSecret({key: "key1", value: "val1"});
        await insertSecret({key: "key2", value: "val2"});
        await insertSecret({key: "key3", value: "val3"});

        const socket = connectSocket({query: {limit: "2"}});
        await waitForOpen(socket);

        const messages = await collectMessages(socket);

        expect(messages).toMatchObject([
          {kind: ChunkKind.Initial, document: {key: "key1"}},
          {kind: ChunkKind.Initial, document: {key: "key2"}},
          {kind: ChunkKind.EndOfInitial}
        ]);

        const docs = messages.filter(m => m.document).map(m => m.document);
        for (const doc of docs) {
          expect(doc).not.toHaveProperty("value");
        }
      });

      it("should perform 'skip' action", async () => {
        await insertSecret({key: "key1", value: "val1"});
        await insertSecret({key: "key2", value: "val2"});
        await insertSecret({key: "key3", value: "val3"});

        const socket = connectSocket({query: {skip: "1"}});
        await waitForOpen(socket);

        const messages = await collectMessages(socket);

        expect(messages).toMatchObject([
          {kind: ChunkKind.Initial, document: {key: "key2"}},
          {kind: ChunkKind.Initial, document: {key: "key3"}},
          {kind: ChunkKind.EndOfInitial}
        ]);

        const docs = messages.filter(m => m.document).map(m => m.document);
        for (const doc of docs) {
          expect(doc).not.toHaveProperty("value");
        }
      });

      it("should perform 'sort' action", async () => {
        await insertSecret({key: "b-key", value: "valB"});
        await insertSecret({key: "a-key", value: "valA"});
        await insertSecret({key: "c-key", value: "valC"});

        const socket = connectSocket({query: {sort: JSON.stringify({key: 1})}});
        await waitForOpen(socket);

        const messages = await collectMessages(socket);
        expect(messages).toMatchObject([
          {kind: ChunkKind.Initial, document: {key: "a-key"}},
          {kind: ChunkKind.Initial, document: {key: "b-key"}},
          {kind: ChunkKind.Initial, document: {key: "c-key"}},
          {kind: ChunkKind.EndOfInitial}
        ]);

        const docs = messages.filter(m => m.document).map(m => m.document);
        for (const doc of docs) {
          expect(doc).not.toHaveProperty("value");
        }
      });
    });
  });
});
