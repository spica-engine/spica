import {ForbiddenException, INestApplication, UnauthorizedException} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket/src";
import {CoreTestingModule, Request, Websocket} from "@spica-server/core/testing";
import {WsAdapter} from "@spica-server/core/websocket";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {GuardService} from "@spica-server/passport/guard/services";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {OBJECTID_STRING, DATE_TIME, OBJECT_ID} from "@spica-server/core/schema/formats";
import {CREATED_AT, UPDATED_AT} from "@spica-server/core/schema/defaults";
import {ChunkKind} from "@spica-server/interface/realtime";
import {Bucket} from "@spica-server/interface/bucket";

function url(path: string, query?: {[k: string]: string | number | boolean | object}) {
  const url = new URL(path, "ws://insteadof");
  for (const key in query) {
    url.searchParams.set(
      key,
      (typeof query[key] == "string" ? String(query[key]) : JSON.stringify(query[key])) as string
    );
  }
  return `${url.pathname}${url.search}`;
}

xdescribe("Realtime", () => {
  let wsc: Websocket;
  let app: INestApplication;
  let req: Request;

  let buckets: Bucket[];

  async function insertBucket(doc: Bucket) {
    const {body} = await req.post("/bucket", doc);
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
        BucketModule.forRoot({
          history: false,
          hooks: false,
          realtime: true,
          cache: false,
          graphql: false
        }),
        PassportTestingModule.initialize({
          overriddenStrategyType: "APIKEY"
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
      const ws = wsc.get("/bucket", {
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

    it("should show error messages", done => {
      authGuardCheck.mockImplementation(() => {
        throw new UnauthorizedException();
      });
      const ws = wsc.get("/bucket", {
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
      const ws = wsc.get("/bucket", {
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
      buckets = [
        await insertBucket({
          title: "first",
          description: "first description",
          properties: {
            name: {
              type: "string",
              options: {
                position: "bottom"
              }
            }
          },
          primary: "name",
          acl: {read: "true==true", write: "true==true"}
        }),
        await insertBucket({
          title: "second",
          description: "second description",
          properties: {
            prop: {
              type: "string",
              options: {
                position: "bottom"
              }
            }
          },
          primary: "prop",
          acl: {read: "true==true", write: "true==true"}
        })
      ];

      messageSpy.mockClear();
    });

    describe("initial sync", () => {
      const lastMessage = JSON.stringify({kind: ChunkKind.EndOfInitial});

      it("should do the initial sync", done => {
        const ws = wsc.get("/bucket");

        ws.onmessage = async e => {
          messageSpy(JSON.parse(e.data as string));

          if (e.data == lastMessage) {
            expect(messageSpy.mock.calls.map(c => c[0])).toEqual([
              {kind: ChunkKind.Initial, document: buckets[0]},
              {kind: ChunkKind.Initial, document: buckets[1]},
              {kind: ChunkKind.EndOfInitial}
            ]);

            await ws.close();
            done();
          }
        };

        ws.connect;
      });

      it("should do the initial sync with limit", done => {
        const ws = wsc.get(url("/bucket", {limit: 1}));

        ws.onmessage = async e => {
          messageSpy(JSON.parse(e.data as string));

          if (e.data == lastMessage) {
            expect(messageSpy.mock.calls.map(c => c[0])).toEqual([
              {kind: ChunkKind.Initial, document: buckets[0]},
              {kind: ChunkKind.EndOfInitial}
            ]);

            await ws.close();
            done();
          }
        };

        ws.connect;
      });

      it("should do the initial sync with skip", done => {
        const ws = wsc.get(url("/bucket", {skip: 1}));

        ws.onmessage = async e => {
          messageSpy(JSON.parse(e.data as string));

          if (e.data == lastMessage) {
            expect(messageSpy.mock.calls.map(c => c[0])).toEqual([
              {kind: ChunkKind.Initial, document: buckets[1]},
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
          insertBucket({
            title: "third",
            description: "third description",
            properties: {
              name: {
                type: "string",
                options: {
                  position: "bottom"
                }
              }
            },
            primary: "name",
            acl: {read: "true==true", write: "true==true"}
          }),
          insertBucket({
            title: "fourth",
            description: "fourth description",
            properties: {
              name: {
                type: "string",
                options: {
                  position: "bottom"
                }
              }
            },
            primary: "name",
            acl: {read: "true==true", write: "true==true"}
          })
        ]).then(newBuckets => {
          const ws = wsc.get(url("/bucket", {skip: 1, limit: 2}));

          ws.onmessage = async e => {
            messageSpy(JSON.parse(e.data as string));

            if (e.data == lastMessage) {
              expect(messageSpy.mock.calls.map(c => c[0])).toEqual([
                {kind: ChunkKind.Initial, document: buckets[1]},
                {kind: ChunkKind.Initial, document: newBuckets[0]},

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
        const ws = wsc.get(url("/bucket", {sort: {_id: -1}}));

        ws.onmessage = async e => {
          messageSpy(JSON.parse(e.data as string));

          if (e.data == lastMessage) {
            expect(messageSpy.mock.calls.map(c => c[0])).toEqual([
              {kind: ChunkKind.Initial, document: buckets[1]},
              {kind: ChunkKind.Initial, document: buckets[0]},
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
        const ws = wsc.get("/bucket");

        ws.onmessage = async e => {
          messageSpy(JSON.parse(e.data as string));

          if (e.data == lastMessage) {
            expect(messageSpy.mock.calls.map(c => c[0])).toEqual([
              {kind: ChunkKind.Initial, document: buckets[0]},
              {kind: ChunkKind.Initial, document: buckets[1]},
              {kind: ChunkKind.EndOfInitial}
            ]);

            const newBucket = await insertBucket({
              title: "new bucket",
              description: "new bucket description",
              properties: {
                name: {
                  type: "string",
                  options: {
                    position: "bottom"
                  }
                }
              },
              primary: "name",
              acl: {read: "true==true", write: "true==true"}
            });

            expect(messageSpy.mock.calls.map(c => c[0])).toEqual([
              {kind: ChunkKind.Initial, document: buckets[0]},
              {kind: ChunkKind.Initial, document: buckets[1]},
              {kind: ChunkKind.EndOfInitial},
              {kind: ChunkKind.Insert, document: newBucket}
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
