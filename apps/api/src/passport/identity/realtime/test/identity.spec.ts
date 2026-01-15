import {ForbiddenException, INestApplication, UnauthorizedException} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request, Websocket} from "@spica-server/core/testing";
import {WsAdapter} from "@spica-server/core/websocket";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {GuardService} from "@spica-server/passport/guard/services";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {OBJECT_ID} from "@spica-server/core/schema/formats";
import {ChunkKind} from "@spica-server/interface/realtime";
import {IdentityModule} from "@spica-server/passport/identity";
import {Identity} from "@spica-server/interface/passport/identity";
import {PolicyModule} from "@spica-server/passport/policy";

function url(query?: {[k: string]: string | number | boolean | object}) {
  const url = new URL("/passport/identity", "ws://insteadof");
  for (const key in query) {
    url.searchParams.set(
      key,
      (typeof query[key] == "string" ? String(query[key]) : JSON.stringify(query[key])) as string
    );
  }
  return `${url.pathname}${url.search}`;
}

xdescribe("Identity Realtime", () => {
  let wsc: Websocket;
  let app: INestApplication;
  let req: Request;

  let identities: Identity[];

  async function insertIdentity(doc: Identity) {
    const {body} = await req.post("/passport/identity", doc);
    return body;
  }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        SchemaModule.forRoot({
          formats: [OBJECT_ID]
        }),
        DatabaseTestingModule.replicaSet(),
        CoreTestingModule,
        PolicyModule.forRoot({realtime: true}),
        PreferenceTestingModule,
        IdentityModule.forRoot({
          expiresIn: 1000,
          issuer: "spica",
          maxExpiresIn: 1000,
          secretOrKey: "spica",
          passwordHistoryLimit: 0,
          blockingOptions: {
            blockDurationMinutes: 0,
            failedAttemptLimit: 0
          },
          identityRealtime: true
        }),
        PassportTestingModule.initialize({
          overriddenStrategyType: "JWT"
        })
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
      const ws = wsc.get("/passport/identity");

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
      const ws = wsc.get("/passport/identity");
      ws.onclose = () => done();
      ws.onmessage = e => {
        expect(e.data).toEqual(`{"kind":-1,"status":401,"message":"Unauthorized"}`);
      };
    });

    it("should the action error message", done => {
      actionGuardCheck.mockImplementation(() => {
        throw new ForbiddenException("You do not have sufficient permissions to do this action.");
      });
      const ws = wsc.get("/passport/identity");
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
      identities = [
        await insertIdentity({
          identifier: "identity 1",
          password: "123",
          policies: undefined,
          failedAttempts: undefined,
          lastLogin: undefined,
          lastPasswords: undefined
        }),
        await insertIdentity({
          identifier: "identity 2",
          password: "123",
          policies: undefined,
          failedAttempts: undefined,
          lastLogin: undefined,
          lastPasswords: undefined
        })
      ];

      messageSpy.mockClear();
    });

    describe("initial sync", () => {
      const lastMessage = JSON.stringify({kind: ChunkKind.EndOfInitial});

      it("should do the initial sync", done => {
        const ws = wsc.get("/passport/identity");

        ws.onmessage = async e => {
          messageSpy(JSON.parse(e.data as string));

          if (e.data == lastMessage) {
            const messages = messageSpy.mock.calls.map(c => c[0]);
            messages.forEach(message => {
              delete message.document?.lastPasswords;
              delete message.document?.password;
            });

            identities.forEach(identity => {
              delete identity.password;
            });

            expect(messages).toEqual([
              {kind: ChunkKind.Initial, document: identities[0]},
              {kind: ChunkKind.Initial, document: identities[1]},
              {kind: ChunkKind.EndOfInitial}
            ]);

            await ws.close();
            done();
          }
        };

        ws.connect;
      });

      it("should do the initial sync with limit", done => {
        const ws = wsc.get(url({limit: 1}));

        ws.onmessage = async e => {
          messageSpy(JSON.parse(e.data as string));

          if (e.data == lastMessage) {
            const messages = messageSpy.mock.calls.map(c => c[0]);
            messages.forEach(message => {
              delete message.document?.lastPasswords;
              delete message.document?.password;
            });

            identities.forEach(identity => {
              delete identity.password;
            });

            expect(messages).toEqual([
              {kind: ChunkKind.Initial, document: identities[0]},
              {kind: ChunkKind.EndOfInitial}
            ]);

            await ws.close();
            done();
          }
        };

        ws.connect;
      });

      it("should do the initial sync with skip", done => {
        const ws = wsc.get(url({skip: 1}));

        ws.onmessage = async e => {
          messageSpy(JSON.parse(e.data as string));

          if (e.data == lastMessage) {
            const messages = messageSpy.mock.calls.map(c => c[0]);
            messages.forEach(message => {
              delete message.document?.lastPasswords;
              delete message.document?.password;
            });

            identities.forEach(identity => {
              delete identity.password;
            });

            expect(messages).toEqual([
              {kind: ChunkKind.Initial, document: identities[1]},
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
          insertIdentity({
            identifier: "identity 3",
            password: "123",
            policies: undefined,
            failedAttempts: undefined,
            lastLogin: undefined,
            lastPasswords: undefined
          }),
          insertIdentity({
            identifier: "identity 4",
            password: "123",
            policies: undefined,
            failedAttempts: undefined,
            lastLogin: undefined,
            lastPasswords: undefined
          })
        ]).then(newIdentities => {
          const ws = wsc.get(url({skip: 1, limit: 2}));

          ws.onmessage = async e => {
            messageSpy(JSON.parse(e.data as string));

            if (e.data == lastMessage) {
              const messages = messageSpy.mock.calls.map(c => c[0]);
              messages.forEach(message => {
                delete message.document?.lastPasswords;
                delete message.document?.password;
              });

              identities.forEach(identity => {
                delete identity.password;
              });

              expect(messages).toEqual([
                {kind: ChunkKind.Initial, document: identities[1]},
                {kind: ChunkKind.Initial, document: newIdentities[0]},
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
            const messages = messageSpy.mock.calls.map(c => c[0]);
            messages.forEach(message => {
              delete message.document?.lastPasswords;
              delete message.document?.password;
            });

            identities.forEach(identity => {
              delete identity.password;
            });

            expect(messages).toEqual([
              {kind: ChunkKind.Initial, document: identities[1]},
              {kind: ChunkKind.Initial, document: identities[0]},
              {kind: ChunkKind.EndOfInitial}
            ]);

            await ws.close();
            done();
          }
        };

        ws.connect;
      });

      it("should do the initial sync with filter", done => {
        const ws = wsc.get(url({filter: {identifier: {$eq: "identity 1"}}}));

        ws.onmessage = async e => {
          messageSpy(JSON.parse(e.data as string));

          if (e.data == lastMessage) {
            const messages = messageSpy.mock.calls.map(c => c[0]);
            messages.forEach(message => {
              delete message.document?.lastPasswords;
              delete message.document?.password;
            });

            identities.forEach(identity => {
              delete identity.password;
            });

            expect(messages).toEqual([
              {kind: ChunkKind.Initial, document: identities[0]},
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
