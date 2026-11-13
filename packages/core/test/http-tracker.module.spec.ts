import {
  CanActivate,
  Controller,
  Get,
  INestApplication,
  Inject,
  Module,
  OnModuleInit,
  Req,
  UseGuards
} from "@nestjs/common";
import {HttpAdapterHost} from "@nestjs/core";
import {Test} from "@nestjs/testing";
import {getCurrentTrace} from "@spica-server/core-trace";
import {HTTP_TRACKER, HttpTracker, HttpTrackerModule} from "@spica-server/core-http-tracker";
import express from "express";
import http from "http";
import {AddressInfo} from "net";

class DenyGuard implements CanActivate {
  canActivate() {
    return false;
  }
}

let downstreamUrl: string;
const seen: Record<string, any> = {};

@Controller()
class ProbeController {
  @Get("ctl")
  ctl(@Req() req: express.Request) {
    seen.ctl = {current: getCurrentTrace(), headers: {...req.headers}};
    return "ok";
  }

  @Get("outgoing")
  async outgoing() {
    return (await fetch(downstreamUrl)).text();
  }

  @Get("guarded")
  @UseGuards(DenyGuard)
  guarded() {
    return "never";
  }
}

@Module({controllers: [ProbeController]})
class ProbeModule implements OnModuleInit {
  constructor(
    private host: HttpAdapterHost,
    @Inject(HTTP_TRACKER) private tracker: HttpTracker
  ) {}

  onModuleInit() {
    const app: express.Application = this.host.httpAdapter.getInstance();

    app.get("/late", (_req, res) => {
      seen.late = getCurrentTrace();
      res.end("late");
    });

    const router = express.Router();
    router.use(this.tracker.handler);
    router.get("/x", (_req, res) => res.end("hoisted"));
    const stack = (app as any)._router.stack;
    app.use("/hoisted", router);
    const layer = stack.splice(stack.length - 1, 1)[0];
    stack.splice(stack.findIndex((l: any) => l.name === "expressInit") + 1, 0, layer);
  }
}

describe("HttpTrackerModule", () => {
  let app: INestApplication;
  let baseUrl: string;
  let downstream: http.Server;
  let accessLog: string[];

  beforeEach(async () => {
    accessLog = [];
    Object.keys(seen).forEach(key => delete seen[key]);

    downstream = http.createServer((req, res) =>
      res.end(JSON.stringify({requestId: req.headers["x-spica-request-id"] ?? null}))
    );
    await new Promise<void>(resolve => downstream.listen(0, "127.0.0.1", resolve));
    downstreamUrl = `http://127.0.0.1:${(downstream.address() as AddressInfo).port}`;

    const moduleRef = await Test.createTestingModule({
      imports: [
        HttpTrackerModule.forRoot({
          accessLogs: true,
          accessLogsStream: {write: line => accessLog.push(String(line).trim())}
        }),
        ProbeModule
      ]
    }).compile();
    app = moduleRef.createNestApplication({bodyParser: false});

    const instance: express.Application = app.getHttpAdapter().getInstance();
    instance.use((_req, _res, next) => next());
    instance.get("/early", (_req, res) => res.end("early"));

    await app.listen(0, "127.0.0.1");
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await app.close();
    await new Promise(resolve => downstream.close(resolve));
  });

  const get = (path: string, headers: Record<string, string> = {}) =>
    fetch(baseUrl + path, {headers});

  it("logs a controller response with the correlation fields and returns the request id", async () => {
    const response = await get("/ctl", {
      "x-spica-request-id": "11111111-2222-3333-4444-555555555555"
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-spica-request-id")).toBe("11111111-2222-3333-4444-555555555555");
    expect(accessLog).toHaveLength(1);
    expect(accessLog[0]).toContain('"GET /ctl HTTP/1.1" 200');
    expect(accessLog[0]).toContain("request_id=11111111-2222-3333-4444-555555555555");
  });

  it("makes the trace current inside the controller and rewrites the incoming headers", async () => {
    await get("/ctl", {"x-spica-hop-id": "spoofedspoofed00"});

    const {current, headers} = seen.ctl;
    expect(current.hopId).toMatch(/^[0-9a-f]{16}$/);
    expect(headers["x-spica-hop-id"]).toBe(current.hopId);
    expect(headers["x-spica-request-id"]).toBe(current.requestId);
  });

  it("logs a request rejected by a guard", async () => {
    const response = await get("/guarded");

    expect(response.status).toBe(403);
    expect(accessLog).toHaveLength(1);
    expect(accessLog[0]).toContain('"GET /guarded HTTP/1.1" 403');
  });

  it("logs a request for a route that does not exist", async () => {
    const response = await get("/nope");

    expect(response.status).toBe(404);
    expect(accessLog).toHaveLength(1);
    expect(accessLog[0]).toContain('"GET /nope HTTP/1.1" 404');
  });

  it("covers routes added on the express instance during onModuleInit", async () => {
    await get("/late");

    expect(accessLog).toHaveLength(1);
    expect(accessLog[0]).toContain('"GET /late HTTP/1.1" 200');
    expect(seen.late).toBeDefined();
  });

  it("logs a router hoisted ahead of the module middleware once, through its own handler", async () => {
    const response = await get("/hoisted/x");

    expect(response.status).toBe(200);
    expect(accessLog).toHaveLength(1);
    expect(accessLog[0]).toContain('"GET /hoisted/x HTTP/1.1" 200');
  });

  it("does not cover routes registered on express before nest initialised", async () => {
    const response = await get("/early");

    expect(response.status).toBe(200);
    expect(accessLog).toEqual([]);
  });

  it("adds the request id to the calls a handler makes", async () => {
    const response = await get("/outgoing", {
      "x-spica-request-id": "11111111-2222-3333-4444-555555555555"
    });

    expect(JSON.parse(await response.text())).toEqual({
      requestId: "11111111-2222-3333-4444-555555555555"
    });
  });
});
