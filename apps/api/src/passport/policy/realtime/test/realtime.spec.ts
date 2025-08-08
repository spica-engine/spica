import {ForbiddenException, INestApplication, UnauthorizedException} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request, Websocket} from "../../../../../../../libs/core/testing";
import {WsAdapter} from "../../../../../../../libs/core/websocket";
import {DatabaseTestingModule, ObjectId} from "../../../../../../../libs/database/testing";
import {GuardService} from "../../..";
import {PassportTestingModule} from "../../../testing";
import {PreferenceTestingModule} from "../../../../preference/testing";
import {SchemaModule} from "../../../../../../../libs/core/schema";
import {OBJECTID_STRING, DATE_TIME, OBJECT_ID} from "../../../../../../../libs/core/schema/formats";
import {CREATED_AT, UPDATED_AT} from "../../../../../../../libs/core/schema/defaults";
import {ChunkKind} from "../../../../../../../libs/interface/realtime";
import {PolicyModule} from "../../src";

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

describe("Realtime", () => {
  let wsc;
  let app;
  let req;

  let policies = [];

  async function insertPolicy(doc) {
    const {body} = await req.post("/passport/policy", doc);
    return body;
  }
  function connectSocket({query = {}, headers = {}} = {}) {
    return wsc.get(url("/passport/policy", query), {headers});
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
        socket.close();
        resolve(messages);
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
        PolicyModule.forRoot({realtime: true}),
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
      const ws = wsc.get("/passport/policy", {
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

      const ws = wsc.get("/passport/policy", {
        headers: {Authorization: "APIKEY test"}
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

      const ws = wsc.get("/passport/policy", {
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
        policies = [
          await insertPolicy({
            _id: new ObjectId().toHexString(),
            name: "Activity Full Access",
            description: "Full access to activity service.",
            statement: [
              {action: "activity:index", module: "activity"},
              {action: "activity:delete", module: "activity"}
            ]
          }),
          await insertPolicy({
            _id: new ObjectId().toHexString(),
            name: "ApiKey Read Only Access",
            description: "Read only access to passport apikey service.",
            statement: [
              {
                action: "passport:apikey:index",
                module: "passport:apikey"
              },
              {
                action: "passport:apikey:show",
                module: "passport:apikey"
              },
              {
                action: "passport:apikey:stream",
                module: "passport:apikey"
              }
            ]
          })
        ];

        messageSpy.mockClear();
      });

      describe("initial sync", () => {
        const lastMessage = JSON.stringify({kind: ChunkKind.EndOfInitial});

        it("should do the initial sync", done => {
          const ws = wsc.get("/passport/policy");

          ws.onmessage = async e => {
            messageSpy(JSON.parse(e.data));

            if (e.data === lastMessage) {
              expect(messageSpy.mock.calls.map(c => c[0])).toEqual([
                {kind: ChunkKind.Initial, document: policies[0]},
                {kind: ChunkKind.Initial, document: policies[1]},
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
          const ws = wsc.get("/passport/policy");

          let inserted = false;
          ws.onmessage = async e => {
            messageSpy(JSON.parse(e.data));

            if (e.data === lastMessage && !inserted) {
              inserted = true;
              await insertPolicy({
                _id: new ObjectId().toHexString(),
                name: "Environment Variables Read Only Access",
                description: "Read only access to function environment variables service.",
                statement: [
                  {
                    action: "env-var:index",
                    module: "env-var"
                  },
                  {
                    action: "env-var:show",
                    module: "env-var"
                  }
                ]
              });
              return;
            }

            if (inserted) {
              const msg = JSON.parse(e.data);
              if (msg.kind === ChunkKind.Insert) {
                expect(messageSpy.mock.calls.map(c => c[0])).toEqual([
                  {kind: ChunkKind.Initial, document: policies[0]},
                  {kind: ChunkKind.Initial, document: policies[1]},
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
        const p1 = {
          _id: new ObjectId().toHexString(),
          name: "Activity Full Access",
          description: "Full access to activity service.",
          statement: [
            {action: "activity:index", module: "activity"},
            {action: "activity:delete", module: "activity"}
          ]
        };
        const p2 = {
          _id: new ObjectId().toHexString(),
          name: "ApiKey Read Only Access",
          description: "Read only access to passport apikey service.",
          statement: [
            {action: "passport:apikey:index", module: "passport:apikey"},
            {action: "passport:apikey:show", module: "passport:apikey"},
            {action: "passport:apikey:stream", module: "passport:apikey"}
          ]
        };
        const p3 = {
          _id: new ObjectId().toHexString(),
          name: "Environment Variables Read Only Access",
          description: "Read only access to function environment variables service.",
          statement: [
            {action: "env-var:index", module: "env-var"},
            {action: "env-var:show", module: "env-var"}
          ]
        };

        await insertPolicy(p1);
        await insertPolicy(p2);
        await insertPolicy(p3);

        const socket = connectSocket({query: {limit: "2"}});
        await waitForOpen(socket);

        const messages = await collectMessages(socket);

        expect(messages).toMatchObject([
          {kind: ChunkKind.Initial, document: p1},
          {kind: ChunkKind.Initial, document: p2},
          {kind: ChunkKind.EndOfInitial}
        ]);
      });

      it("should perform 'skip' action", async () => {
        const p1 = {
          _id: new ObjectId().toHexString(),
          name: "Activity Full Access",
          description: "Full access to activity service.",
          statement: [
            {action: "activity:index", module: "activity"},
            {action: "activity:delete", module: "activity"}
          ]
        };
        const p2 = {
          _id: new ObjectId().toHexString(),
          name: "ApiKey Read Only Access",
          description: "Read only access to passport apikey service.",
          statement: [
            {action: "passport:apikey:index", module: "passport:apikey"},
            {action: "passport:apikey:show", module: "passport:apikey"},
            {action: "passport:apikey:stream", module: "passport:apikey"}
          ]
        };
        const p3 = {
          _id: new ObjectId().toHexString(),
          name: "Environment Variables Read Only Access",
          description: "Read only access to function environment variables service.",
          statement: [
            {action: "env-var:index", module: "env-var"},
            {action: "env-var:show", module: "env-var"}
          ]
        };

        await insertPolicy(p1);
        await insertPolicy(p2);
        await insertPolicy(p3);

        const socket = connectSocket({query: {skip: "1", sort: JSON.stringify({name: 1})}});
        await waitForOpen(socket);

        const messages = await collectMessages(socket);

        expect(messages).toMatchObject([
          {kind: ChunkKind.Initial, document: p2},
          {kind: ChunkKind.Initial, document: p3},
          {kind: ChunkKind.EndOfInitial}
        ]);
      });

      it("should perform 'sort' action", async () => {
        const p1 = {
          _id: new ObjectId().toHexString(),
          name: "b-Policy",
          description: "Full access to activity service.",
          statement: [
            {action: "activity:index", module: "activity"},
            {action: "activity:delete", module: "activity"}
          ]
        };
        const p2 = {
          _id: new ObjectId().toHexString(),
          name: "c-Policy",
          description: "Read only access to passport apikey service.",
          statement: [
            {action: "passport:apikey:index", module: "passport:apikey"},
            {action: "passport:apikey:show", module: "passport:apikey"},
            {action: "passport:apikey:stream", module: "passport:apikey"}
          ]
        };
        const p3 = {
          _id: new ObjectId().toHexString(),
          name: "a-Policy",
          description: "Read only access to function environment variables service.",
          statement: [
            {action: "env-var:index", module: "env-var"},
            {action: "env-var:show", module: "env-var"}
          ]
        };

        await insertPolicy(p1);
        await insertPolicy(p2);
        await insertPolicy(p3);

        const socket = connectSocket({query: {sort: JSON.stringify({name: 1})}});
        await waitForOpen(socket);

        const messages = await collectMessages(socket);

        expect(messages).toMatchObject([
          {kind: ChunkKind.Initial, document: p3},
          {kind: ChunkKind.Initial, document: p1},
          {kind: ChunkKind.Initial, document: p2},
          {kind: ChunkKind.EndOfInitial}
        ]);
      });
    });
  });
});
