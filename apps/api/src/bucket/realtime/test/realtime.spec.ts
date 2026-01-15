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

describe("Realtime", () => {
  let wsc: Websocket;
  let app: INestApplication;
  let req: Request;

  let bucket: any;
  let rows: any[];

  async function insertRow(doc) {
    const {body} = await req.post(`/bucket/${bucket._id}/data`, doc);
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

    const {body: bkt} = await req.post("/bucket", {
      title: "Realtime",
      description: "Realtime",
      properties: {
        title: {
          type: "string"
        }
      }
    });
    bucket = bkt;
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
          options?: {
            resourceFilter: boolean;
          };
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
      const ws = wsc.get(`/bucket/${bucket._id}/data`, {
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
      const ws = wsc.get(`/bucket/${bucket._id}/data`, {
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
      const ws = wsc.get(`/bucket/${bucket._id}/data`, {
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
      rows = [
        await insertRow({
          title: "first"
        }),
        await insertRow({
          title: "second"
        })
      ];

      messageSpy.mockClear();
    });

    describe("initial sync", () => {
      const lastMessage = JSON.stringify({kind: ChunkKind.EndOfInitial});

      it("should do the initial sync", done => {
        const ws = wsc.get(`/bucket/${bucket._id}/data`);

        ws.onmessage = async e => {
          messageSpy(JSON.parse(e.data as string));

          if (e.data == lastMessage) {
            expect(messageSpy.mock.calls.map(c => c[0])).toEqual([
              {kind: ChunkKind.Initial, document: rows[0]},
              {kind: ChunkKind.Initial, document: rows[1]},
              {kind: ChunkKind.EndOfInitial}
            ]);

            await ws.close();
            done();
          }
        };

        ws.connect;
      });

      it("should do the initial sync with filter", done => {
        const ws = wsc.get(url(`/bucket/${bucket._id}/data`, {filter: `title == "second"`}));

        ws.onmessage = async e => {
          messageSpy(JSON.parse(e.data as string));

          if (e.data == lastMessage) {
            expect(messageSpy.mock.calls.map(c => c[0])).toEqual([
              {kind: ChunkKind.Initial, document: rows[1]},
              {kind: ChunkKind.EndOfInitial}
            ]);

            await ws.close();
            done();
          }
        };

        ws.connect;
      });

      it("should do the initial sync with _id filter", done => {
        const ws = wsc.get(
          url(`/bucket/${bucket._id}/data`, {filter: `document._id == "${rows[0]["_id"]}"`})
        );

        ws.onmessage = async e => {
          messageSpy(JSON.parse(e.data as string));

          if (e.data == lastMessage) {
            expect(messageSpy.mock.calls.map(c => c[0])).toEqual([
              {kind: ChunkKind.Initial, document: rows[0]},
              {kind: ChunkKind.EndOfInitial}
            ]);

            await ws.close();
            done();
          }
        };

        ws.connect;
      });

      it("should do the initial sync with limit", done => {
        const ws = wsc.get(url(`/bucket/${bucket._id}/data`, {limit: 1}));

        ws.onmessage = async e => {
          messageSpy(JSON.parse(e.data as string));

          if (e.data == lastMessage) {
            expect(messageSpy.mock.calls.map(c => c[0])).toEqual([
              {kind: ChunkKind.Initial, document: rows[0]},
              {kind: ChunkKind.EndOfInitial}
            ]);

            await ws.close();
            done();
          }
        };

        ws.connect;
      });

      it("should do the initial sync with skip", done => {
        const ws = wsc.get(url(`/bucket/${bucket._id}/data`, {skip: 1}));

        ws.onmessage = async e => {
          messageSpy(JSON.parse(e.data as string));

          if (e.data == lastMessage) {
            expect(messageSpy.mock.calls.map(c => c[0])).toEqual([
              {kind: ChunkKind.Initial, document: rows[1]},
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
          insertRow({
            title: "third"
          }),
          insertRow({
            title: "fourth"
          })
        ]).then(newRows => {
          const ws = wsc.get(url(`/bucket/${bucket._id}/data`, {skip: 1, limit: 2}));

          ws.onmessage = async e => {
            messageSpy(JSON.parse(e.data as string));

            if (e.data == lastMessage) {
              console.log(messageSpy.mock.calls.map(c => c[0]));
              expect(messageSpy.mock.calls.map(c => c[0])).toEqual([
                {kind: ChunkKind.Initial, document: rows[1]},
                {kind: ChunkKind.Initial, document: newRows[0]},

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
        const ws = wsc.get(url(`/bucket/${bucket._id}/data`, {sort: {_id: -1}}));

        ws.onmessage = async e => {
          messageSpy(JSON.parse(e.data as string));

          if (e.data == lastMessage) {
            expect(messageSpy.mock.calls.map(c => c[0])).toEqual([
              {kind: ChunkKind.Initial, document: rows[1]},
              {kind: ChunkKind.Initial, document: rows[0]},
              {kind: ChunkKind.EndOfInitial}
            ]);

            await ws.close();
            done();
          }
        };

        ws.connect;
      });
    });

    describe("sending message", () => {
      it("should perform insert action and send changes to the clients", done => {
        const ws = wsc.get(url(`/bucket/${bucket._id}/data`));

        ws.onmessage = async e => {
          const message = JSON.parse(e.data as string);
          messageSpy(message);

          if (message.kind == ChunkKind.Insert) {
            const messages = messageSpy.mock.calls.map(c => c[0]);
            const insertedId = messages[4].document._id;

            expect(ObjectId.isValid(insertedId)).toEqual(true);
            expect(messages).toEqual([
              {kind: ChunkKind.Initial, document: rows[0]},
              {kind: ChunkKind.Initial, document: rows[1]},
              {kind: ChunkKind.EndOfInitial},
              {kind: ChunkKind.Response, status: 201, message: "Created"},
              {
                kind: ChunkKind.Insert,
                document: {_id: insertedId, title: "hey"}
              }
            ]);
            await ws.close();
            done();
          }
        };

        ws.connect.then(() => ws.send(JSON.stringify({event: "insert", data: {title: "hey"}})));
      });

      it("should perform replace action and send changes to the clients", done => {
        const ws = wsc.get(url(`/bucket/${bucket._id}/data`));

        ws.onmessage = async e => {
          const message = JSON.parse(e.data as string);
          messageSpy(message);

          if (message.kind == ChunkKind.Replace) {
            expect(messageSpy.mock.calls.map(c => c[0])).toEqual([
              {kind: ChunkKind.Initial, document: rows[0]},
              {kind: ChunkKind.Initial, document: rows[1]},
              {kind: ChunkKind.EndOfInitial},
              {kind: ChunkKind.Response, status: 200, message: "OK"},
              {
                kind: ChunkKind.Replace,
                document: {_id: rows[0]._id, title: "hello"}
              }
            ]);
            await ws.close();
            done();
          }
        };

        ws.connect.then(() =>
          ws.send(JSON.stringify({event: "replace", data: {_id: rows[0]._id, title: "hello"}}))
        );
      });

      it("should perform patch action and send changes to the clients", done => {
        const ws = wsc.get(url(`/bucket/${bucket._id}/data`));

        ws.onmessage = async e => {
          const message = JSON.parse(e.data as string);
          messageSpy(message);

          if (message.kind == ChunkKind.Update) {
            expect(messageSpy.mock.calls.map(c => c[0])).toEqual([
              {kind: ChunkKind.Initial, document: rows[0]},
              {kind: ChunkKind.Initial, document: rows[1]},
              {kind: ChunkKind.EndOfInitial},
              {kind: ChunkKind.Response, status: 204, message: "No Content"},
              {
                kind: ChunkKind.Update,
                document: {_id: rows[0]._id}
              }
            ]);
            await ws.close();
            done();
          }
        };

        ws.connect.then(() =>
          ws.send(JSON.stringify({event: "patch", data: {_id: rows[0]._id, title: null}}))
        );
      });

      it("should perform delete action and send changes to the clients", done => {
        const ws = wsc.get(url(`/bucket/${bucket._id}/data`));

        ws.onmessage = async e => {
          const message = JSON.parse(e.data as string);
          messageSpy(message);

          if (message.kind == ChunkKind.Delete) {
            expect(messageSpy.mock.calls.map(c => c[0])).toEqual([
              {kind: ChunkKind.Initial, document: rows[0]},
              {kind: ChunkKind.Initial, document: rows[1]},
              {kind: ChunkKind.EndOfInitial},
              {kind: ChunkKind.Response, status: 204, message: "No Content"},
              {
                kind: ChunkKind.Delete,
                document: {_id: rows[0]._id}
              }
            ]);
            await ws.close();
            done();
          }
        };

        ws.connect.then(() => ws.send(JSON.stringify({event: "delete", data: {_id: rows[0]._id}})));
      });
    });

    describe("errors", () => {
      const lastMessageKind = ChunkKind.Response;

      describe("schema validation", () => {
        let validationBucket: any = {
          title: "Realtime",
          description: "Realtime",
          properties: {
            title: {
              type: "string"
            }
          },
          required: ["title"]
        };
        beforeEach(async () => {
          await req.post("/bucket", validationBucket).then(res => (validationBucket = res.body));
        });

        it("should reject operation and send errors to the client", done => {
          const ws = wsc.get(url(`/bucket/${validationBucket._id}/data`));

          ws.onmessage = async e => {
            const message = JSON.parse(e.data as string);
            messageSpy(message);

            if (message.kind == lastMessageKind) {
              expect(messageSpy.mock.calls.map(c => c[0])).toEqual([
                {kind: ChunkKind.EndOfInitial},
                {
                  kind: ChunkKind.Response,
                  status: 400,
                  message: " must have required property 'title'"
                }
              ]);
              await ws.close();
              done();
            }
          };

          ws.connect.then(() => ws.send(JSON.stringify({event: "insert", data: {}})));
        });
      });
    });
  });
});
