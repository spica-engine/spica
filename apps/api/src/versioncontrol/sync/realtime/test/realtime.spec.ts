import {ForbiddenException, UnauthorizedException} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request, Websocket} from "@spica-server/core/testing";
import {WsAdapter} from "@spica-server/core/websocket";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {GuardService} from "@spica-server/passport/guard/services";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {ChunkKind} from "@spica-server/interface/realtime";
import {ChangeOrigin, ChangeType, SyncStatuses} from "@spica-server/interface/versioncontrol";
import {SyncService} from "@spica-server/versioncontrol/services/sync";
import {ServicesModule as SyncServicesModule} from "@spica-server/versioncontrol/services/sync";
import {SyncRealtimeModule} from "../src";

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

describe("Sync Realtime", () => {
  let wsc;
  let app;
  let req;
  let syncService: SyncService;

  let syncs = [];

  function createMockSync(idSuffix: string, status = SyncStatuses.APPROVED) {
    return {
      _id: new ObjectId(),
      change_log: {
        created_at: new Date(),
        module: "test",
        sub_module: "sync",
        origin: ChangeOrigin.DOCUMENT,
        type: ChangeType.CREATE,
        resource_content: "{}",
        resource_id: `resource-${idSuffix}`,
        resource_slug: `slug-${idSuffix}`,
        resource_extension: "json"
      },
      created_at: new Date(),
      status: status,
      updated_at: new Date()
    };
  }

  function connectSocket({query = {}, headers = {}} = {}) {
    return wsc.get(url("/versioncontrol/sync", query), {headers});
  }

  function waitForOpen(socket: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("WebSocket did not open in time")), 5000);
      if (socket.connected) {
        clearTimeout(timeout);
        return resolve();
      }

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
        DatabaseTestingModule.replicaSet(),
        CoreTestingModule,
        SyncServicesModule.forRoot(),
        SyncRealtimeModule.register(),
        PassportTestingModule.initialize({overriddenStrategyType: "APIKEY"})
      ]
    }).compile();

    module.enableShutdownHooks();
    wsc = module.get(Websocket);
    req = module.get(Request);
    syncService = module.get(SyncService);
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
      const ws = wsc.get("/versioncontrol/sync", {
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

      const ws = wsc.get("/versioncontrol/sync", {
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

      const ws = wsc.get("/versioncontrol/sync", {
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
        syncs = [
          await syncService.insertOne(createMockSync("sync1", SyncStatuses.PENDING)),
          await syncService.insertOne(createMockSync("sync2", SyncStatuses.PENDING))
        ];

        messageSpy.mockClear();
      });

      describe("initial sync", () => {
        const lastMessage = JSON.stringify({kind: ChunkKind.EndOfInitial});

        it("should do the initial sync", done => {
          const ws = wsc.get("/versioncontrol/sync");

          ws.onmessage = async e => {
            messageSpy(JSON.parse(e.data));

            if (e.data === lastMessage) {
              const messages = messageSpy.mock.calls.map(c => c[0]);
              expect(messages).toMatchObject([
                {kind: ChunkKind.Initial, document: {status: SyncStatuses.PENDING}},
                {kind: ChunkKind.Initial, document: {status: SyncStatuses.PENDING}},
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
        it("should listen changes", done => {
          const ws = wsc.get("/versioncontrol/sync");

          let changeDetected = false;

          ws.onmessage = async e => {
            const msg = JSON.parse(e.data);
            messageSpy(msg);

            if (msg.kind === ChunkKind.EndOfInitial && !changeDetected) {
              changeDetected = true;
              await syncService.insertOne(createMockSync("sync3", SyncStatuses.PENDING));
              return;
            }

            if (changeDetected && msg.kind === ChunkKind.Insert) {
              const messages = messageSpy.mock.calls.map(c => c[0]);
              expect(messages).toMatchObject([
                {kind: ChunkKind.Initial, document: {status: SyncStatuses.PENDING}},
                {kind: ChunkKind.Initial, document: {status: SyncStatuses.PENDING}},
                {kind: ChunkKind.EndOfInitial},
                {kind: ChunkKind.Insert, document: {status: SyncStatuses.PENDING}}
              ]);
              await ws.close();
              done();
            }
          };

          ws.connect;
        });
      });

      describe("query operations", () => {
        it("should perform 'limit' action", async () => {
          const socket = connectSocket({query: {limit: "1"}});
          await waitForOpen(socket);

          const messages = await collectMessages(socket);

          expect(messages).toMatchObject([
            {kind: ChunkKind.Initial, document: {status: SyncStatuses.PENDING}},
            {kind: ChunkKind.EndOfInitial}
          ]);
        });

        it("should perform 'skip' action", async () => {
          const socket = connectSocket({query: {skip: "1"}});
          await waitForOpen(socket);

          const messages = await collectMessages(socket);

          expect(messages).toMatchObject([
            {kind: ChunkKind.Initial, document: {status: SyncStatuses.PENDING}},
            {kind: ChunkKind.EndOfInitial}
          ]);
        });

        it("should perform 'sort' action", async () => {
          const socket = connectSocket({query: {sort: JSON.stringify({created_at: -1})}});
          await waitForOpen(socket);

          const messages = await collectMessages(socket);

          expect(messages).toMatchObject([
            {kind: ChunkKind.Initial, document: {status: SyncStatuses.PENDING}},
            {kind: ChunkKind.Initial, document: {status: SyncStatuses.PENDING}},
            {kind: ChunkKind.EndOfInitial}
          ]);
        });
      });
    });
  });
});
