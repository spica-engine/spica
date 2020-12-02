import {ForbiddenException, INestApplication, UnauthorizedException} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {RealtimeModule} from "@spica-server/bucket/realtime";
import {BucketModule} from "@spica-server/bucket/src";
import {CoreTestingModule, Request, Websocket} from "@spica-server/core/testing";
import {WsAdapter} from "@spica-server/core/websocket";
import {ChunkKind} from "@spica-server/database/realtime";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {GuardService} from "@spica-server/passport";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";

function url(path: string, query?: {[k: string]: string | number | boolean | object}) {
  const url = new URL(path, "ws://insteadof");
  for (const key in query) {
    url.searchParams.set(key, (typeof query[key] == "string"
      ? String(query[key])
      : JSON.stringify(query[key])) as string);
  }
  return `${url.pathname}${url.search}`;
}

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

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
        DatabaseTestingModule.replicaSet(),
        CoreTestingModule,
        RealtimeModule,
        PreferenceTestingModule,
        BucketModule.forRoot({
          history: false,
          hooks: false,
          realtime: false
        }),
        PassportTestingModule.initialize()
      ]
    }).compile();
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
    rows = [
      await insertRow({
        title: "first"
      }),
      await insertRow({
        title: "second"
      })
    ];
  });

  afterEach(() => app.close());

  describe("authorization", () => {
    let authGuardCheck: jasmine.Spy<typeof GuardService.prototype.checkAuthorization>;
    let actionGuardCheck: jasmine.Spy<typeof GuardService.prototype.checkAction>;

    beforeEach(async () => {
      const guardService = app.get(GuardService);
      authGuardCheck = spyOn(guardService, "checkAuthorization");
      actionGuardCheck = spyOn(guardService, "checkAction");
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

    it("should authorize and do the initial sync", async done => {
      const ws = wsc.get(`/bucket/${bucket._id}/data`, {
        headers: {
          Authorization: "APIKEY test"
        }
      });

      ws.onclose = done;
      ws.onmessage = e => {
        expect(e.data).toEqual(`{"kind":1}`);
      };
      await ws.connect;
      await ws.close();
    });

    it("should show error messages", done => {
      authGuardCheck.and.callFake(() => {
        throw new UnauthorizedException();
      });
      const ws = wsc.get(`/bucket/${bucket._id}/data`, {
        headers: {
          Authorization: "APIKEY test"
        }
      });
      ws.onclose = done;
      ws.onmessage = e => {
        expect(e.data).toEqual(`{"code":401,"message":"Unauthorized"}`);
      };
    });

    it("should the action error message", done => {
      actionGuardCheck.and.callFake(() => {
        throw new ForbiddenException("You do not have sufficient permissions to do this action.");
      });
      const ws = wsc.get(`/bucket/${bucket._id}/data`, {
        headers: {
          Authorization: "APIKEY test"
        }
      });
      ws.onclose = done;
      ws.onmessage = e => {
        expect(e.data).toEqual(
          `{"code":403,"message":"You do not have sufficient permissions to do this action."}`
        );
      };
    });
  });

  it("should do the initial sync", async () => {
    const ws = wsc.get(`/bucket/${bucket._id}/data`);
    const message = jasmine.createSpy();
    ws.onmessage = e => message(JSON.parse(e.data as string));
    await ws.connect;
    await ws.close();
    expect(message.calls.allArgs().map(c => c[0])).toEqual([
      {kind: ChunkKind.Initial, document: rows[0]},
      {kind: ChunkKind.Initial, document: rows[1]},
      {kind: ChunkKind.EndOfInitial}
    ]);
  });

  it("should do the initial sync with filter", async () => {
    const ws = wsc.get(url(`/bucket/${bucket._id}/data`, {filter: `title == "second"`}));
    const message = jasmine.createSpy();
    ws.onmessage = e => message(JSON.parse(e.data as string));
    await ws.connect;
    await ws.close();
    expect(message.calls.allArgs().map(c => c[0])).toEqual([
      {kind: ChunkKind.Initial, document: rows[1]},
      {kind: ChunkKind.EndOfInitial}
    ]);
  });

  it("should do the initial sync with _id filter", async () => {
    const ws = wsc.get(url(`/bucket/${bucket._id}/data`, {filter: `_id == "${rows[0]["_id"]}"`}));
    const message = jasmine.createSpy();
    ws.onmessage = e => message(JSON.parse(e.data as string));
    await ws.connect;
    await ws.close();
    expect(message.calls.allArgs().map(c => c[0])).toEqual([
      {kind: ChunkKind.Initial, document: rows[0]},
      {kind: ChunkKind.EndOfInitial}
    ]);
  });

  it("should do the initial sync with limit", async () => {
    const ws = wsc.get(url(`/bucket/${bucket._id}/data`, {limit: 1}));
    const message = jasmine.createSpy();
    ws.onmessage = e => message(JSON.parse(e.data as string));
    await ws.connect;
    await ws.close();
    expect(message.calls.allArgs().map(c => c[0])).toEqual([
      {kind: ChunkKind.Initial, document: rows[0]},
      {kind: ChunkKind.EndOfInitial}
    ]);
  });

  it("should do the initial sync with skip", async () => {
    const ws = wsc.get(url(`/bucket/${bucket._id}/data`, {skip: 1}));
    const message = jasmine.createSpy();
    ws.onmessage = e => message(JSON.parse(e.data as string));
    await ws.connect;
    await ws.close();
    expect(message.calls.allArgs().map(c => c[0])).toEqual([
      {kind: ChunkKind.Initial, document: rows[1]},
      {kind: ChunkKind.EndOfInitial}
    ]);
  });

  it("should do the initial sync with skip and limit", async () => {
    const newRows = [
      await insertRow({
        title: "third"
      }),
      await insertRow({
        title: "fourth"
      })
    ];
    const ws = wsc.get(url(`/bucket/${bucket._id}/data`, {skip: 1, limit: 2}));
    const message = jasmine.createSpy();
    ws.onmessage = e => message(JSON.parse(e.data as string));
    await ws.connect;
    await ws.close();
    expect(message.calls.allArgs().map(c => c[0])).toEqual([
      {kind: ChunkKind.Initial, document: rows[1]},
      {kind: ChunkKind.Initial, document: newRows[0]},
      {kind: ChunkKind.EndOfInitial}
    ]);
  });

  it("should do the initial sync with sort", async () => {
    const ws = wsc.get(url(`/bucket/${bucket._id}/data`, {sort: {_id: -1}}));
    const message = jasmine.createSpy();
    ws.onmessage = e => message(JSON.parse(e.data as string));
    await ws.connect;
    await ws.close();
    expect(message.calls.allArgs().map(c => c[0])).toEqual([
      {kind: ChunkKind.Initial, document: rows[1]},
      {kind: ChunkKind.Initial, document: rows[0]},
      {kind: ChunkKind.EndOfInitial}
    ]);
  });
});
