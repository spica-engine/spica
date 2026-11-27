import {
  CanActivate,
  Controller,
  Get,
  INestApplication,
  Inject,
  Module,
  OnModuleInit,
  UseGuards
} from "@nestjs/common";
import {HttpAdapterHost} from "@nestjs/core";
import {Test} from "@nestjs/testing";
import {Middlewares} from "@spica-server/core/src/middlewares";
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
  ctl() {
    seen.ctl = getCurrentTrace();
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
    app.use("/hoisted", router);
    const stack = (app as any).router.stack;
    stack.unshift(stack.pop());
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

  it("logs a controller response with the request id of the caller", async () => {
    const response = await get("/ctl", {
      "x-spica-request-id": "11111111-2222-3333-4444-555555555555"
    });

    expect(response.status).toBe(200);
    expect(accessLog).toHaveLength(1);
    expect(accessLog[0]).toContain('"GET /ctl HTTP/1.1" 200');
    expect(accessLog[0]).toContain("spica_request_id=11111111-2222-3333-4444-555555555555");
  });

  it("makes the trace current inside the controller", async () => {
    await get("/ctl");

    expect(seen.ctl.hopId).toMatch(/^[0-9a-f]{16}$/);
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

describe("HttpTrackerModule with the tracker ahead of the preflight middleware", () => {
  let app: INestApplication;
  let baseUrl: string;
  let accessLog: string[];

  beforeEach(async () => {
    accessLog = [];
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
    app.use(
      app.get<HttpTracker>(HTTP_TRACKER).handler,
      Middlewares.Preflight({
        allowedOrigins: ["*"],
        allowedMethods: ["*"],
        allowedHeaders: ["*"],
        allowCredentials: false
      })
    );
    await app.listen(0, "127.0.0.1");
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });

  afterEach(() => app.close());

  it("logs a preflight request that the preflight middleware answers", async () => {
    const response = await fetch(baseUrl + "/bucket", {
      method: "OPTIONS",
      headers: {origin: "http://example.com", "access-control-request-method": "GET"}
    });

    expect(response.status).toBe(200);
    expect(accessLog).toHaveLength(1);
    expect(accessLog[0]).toContain('"OPTIONS /bucket HTTP/1.1" 200');
    expect(accessLog[0]).toMatch(/spica_request_id=[0-9a-f-]{36}/);
  });

  it("logs a regular request once", async () => {
    await fetch(baseUrl + "/ctl");

    expect(accessLog).toHaveLength(1);
    expect(accessLog[0]).toContain('"GET /ctl HTTP/1.1" 200');
  });
});
