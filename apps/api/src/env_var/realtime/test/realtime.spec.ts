import {ForbiddenException, INestApplication, UnauthorizedException} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request, Websocket} from "@spica-server/core/testing";
import {WsAdapter} from "@spica-server/core/websocket";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {GuardService} from "@spica-server/passport/guard/services";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {OBJECTID_STRING, DATE_TIME, OBJECT_ID} from "@spica-server/core/schema/formats";
import {CREATED_AT, UPDATED_AT} from "@spica-server/core/schema/defaults";
import {ChunkKind} from "@spica-server/interface/realtime";
import {EnvVarModule} from "@spica-server/env_var";

function url(path, query) {
  const u = new URL(path, "ws://insteadof");
  for (const key in query) {
    u.searchParams.set(
      key,
      typeof query[key] === "string" ? query[key] : JSON.stringify(query[key])
    );
  }
  return `${u.pathname}${u.search}`;
}

describe("EnvVar Realtime", () => {
  let wsc;
  let app;
  let req;

  let envVars = [];

  async function insertEnvVar(doc) {
    const {body} = await req.post("/env-var", doc);
    return body;
  }
  function connectSocket({query = {}, headers = {}} = {}) {
    return wsc.get(url("/env-var", query), {headers});
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
        SchemaModule.forRoot({
          formats: [OBJECT_ID, DATE_TIME, OBJECTID_STRING],
          defaults: [CREATED_AT, UPDATED_AT]
        }),
        DatabaseTestingModule.replicaSet(),
        CoreTestingModule,
        PreferenceTestingModule,
        EnvVarModule.forRoot({realtime: true}),
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
    let authGuardCheck;
    let actionGuardCheck;

    beforeEach(() => {
      const guardService = app.get(GuardService);
      authGuardCheck = jest.spyOn(guardService, "checkAuthorization");
      actionGuardCheck = jest
        .spyOn(guardService, "checkAction")
        .mockImplementation(({request}: {request: any}) => {
          request.resourceFilter = {include: [], exclude: []};
          return Promise.resolve(true);
        });
    });

    it("should authorize and do the initial sync", done => {
      const ws = wsc.get("/env-var", {
        headers: {Authorization: "APIKEY test"}
      });

      ws.onmessage = e => {
        expect(e.data).toEqual(`{"kind":1}`);
        ws.close().then(() => done());
      };

      ws.connect;
    });

    it("should show error messages", done => {
      authGuardCheck.mockImplementation(() => {
        throw new UnauthorizedException();
      });

      const ws = wsc.get("/env-var", {
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

      const ws = wsc.get("/env-var", {
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
      beforeEach(async () => {
        envVars = [
          await insertEnvVar({key: "TestKey1", value: "val1"}),
          await insertEnvVar({key: "TestKey2", value: "val2"})
        ];

        messageSpy.mockClear();
      });

      describe("initial sync", () => {
        const lastMessage = JSON.stringify({kind: ChunkKind.EndOfInitial});

        it("should do the initial sync", done => {
          const ws = wsc.get("/env-var");

          ws.onmessage = async e => {
            messageSpy(JSON.parse(e.data));

            if (e.data === lastMessage) {
              expect(messageSpy.mock.calls.map(c => c[0])).toEqual([
                {kind: ChunkKind.Initial, document: envVars[0]},
                {kind: ChunkKind.Initial, document: envVars[1]},
                {kind: ChunkKind.EndOfInitial}
              ]);

              await ws.close();
              done();
            }
          };

          ws.connect;
        });
      });

      describe("listening changes", () => {
        const lastMessage = JSON.stringify({kind: ChunkKind.EndOfInitial});

        it("should listen changes", done => {
          const ws = wsc.get("/env-var");

          let inserted = false;
          ws.onmessage = async e => {
            messageSpy(JSON.parse(e.data));

            if (e.data === lastMessage && !inserted) {
              inserted = true;
              await insertEnvVar({key: "TestKey3", value: "val3"});
              return;
            }

            if (inserted) {
              const msg = JSON.parse(e.data);
              if (msg.kind === ChunkKind.Insert) {
                expect(messageSpy.mock.calls.map(c => c[0])).toEqual([
                  {kind: ChunkKind.Initial, document: envVars[0]},
                  {kind: ChunkKind.Initial, document: envVars[1]},
                  {kind: ChunkKind.EndOfInitial},
                  {kind: ChunkKind.Insert, document: msg.document}
                ]);
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
        await insertEnvVar({key: "key1", value: "val1"});
        await insertEnvVar({key: "key2", value: "val2"});
        await insertEnvVar({key: "key3", value: "val3"});

        const socket = connectSocket({query: {limit: "2"}});
        await waitForOpen(socket);

        const messages = await collectMessages(socket);

        expect(messages).toMatchObject([
          {kind: ChunkKind.Initial, document: {key: "key1", value: "val1"}},
          {kind: ChunkKind.Initial, document: {key: "key2", value: "val2"}},
          {kind: ChunkKind.EndOfInitial}
        ]);
      });

      it("should perform 'skip' action", async () => {
        await insertEnvVar({key: "key1", value: "val1"});
        await insertEnvVar({key: "key2", value: "val2"});
        await insertEnvVar({key: "key3", value: "val3"});

        const socket = connectSocket({query: {skip: "1"}});
        await waitForOpen(socket);

        const messages = await collectMessages(socket);

        expect(messages).toMatchObject([
          {kind: ChunkKind.Initial, document: {key: "key2", value: "val2"}},
          {kind: ChunkKind.Initial, document: {key: "key3", value: "val3"}},
          {kind: ChunkKind.EndOfInitial}
        ]);
      });

      it("should perform 'sort' action", async () => {
        await insertEnvVar({key: "b-key", value: "valB"});
        await insertEnvVar({key: "a-key", value: "valA"});
        await insertEnvVar({key: "c-key", value: "valC"});

        const socket = connectSocket({query: {sort: JSON.stringify({key: 1})}});
        await waitForOpen(socket);

        const messages = await collectMessages(socket);
        expect(messages).toMatchObject([
          {kind: ChunkKind.Initial, document: {key: "a-key", value: "valA"}},
          {kind: ChunkKind.Initial, document: {key: "b-key", value: "valB"}},
          {kind: ChunkKind.Initial, document: {key: "c-key", value: "valC"}},
          {kind: ChunkKind.EndOfInitial}
        ]);
      });
    });
  });
});
