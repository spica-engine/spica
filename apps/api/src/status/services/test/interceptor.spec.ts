import {Controller, Get, INestApplication, Post} from "@nestjs/common";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {Middlewares} from "@spica-server/core";
import {StatusModule} from "@spica-server/status";
import {Test} from "@nestjs/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";

const MbInKb = 1000 * 1000;

function sleep(ms: number) {
  return new Promise((resolve, _) => setTimeout(resolve, ms));
}

@Controller("test")
export class TestController {
  constructor() {}

  @Get("void")
  void() {}

  @Get()
  get() {
    return "s".repeat(MbInKb);
  }

  @Post()
  insert() {
    return "s".repeat(MbInKb);
  }
}

describe("Status Interceptor", () => {
  describe("With Module", () => {
    let req: Request;
    let app: INestApplication;

    beforeEach(async () => {
      const module = await Test.createTestingModule({
        imports: [
          DatabaseTestingModule.standalone(),
          CoreTestingModule,
          StatusModule.forRoot({expireAfterSeconds: 60 * 60}),
          PassportTestingModule.initialize()
        ],
        controllers: [TestController]
      }).compile();

      req = module.get(Request);
      app = module.createNestApplication();

      app.use(Middlewares.JsonBodyParser({limit: 3 * MbInKb, ignoreUrls: []}));

      await app.listen(req.socket);
    });

    afterEach(async () => {
      await app.close();
    });

    it("should track request size and count for get request", async () => {
      await req.get("/test");

      await sleep(1000);
      const res = await req.get("/status/api");

      await sleep(2000);

      expect([res.statusCode, res.statusText]).toEqual([200, "OK"]);
      expect(res.body).toEqual({
        module: "api",
        status: {
          request: {
            current: 1,
            unit: "count"
          },
          uploaded: {
            current: 0,
            unit: "mb"
          },
          downloaded: {
            current: 1,
            unit: "mb"
          }
        }
      });
    });

    it("should track request size and count for post request", async () => {
      const body = {message: "a".repeat(2 * MbInKb)};
      await req.post("/test", body);

      const res = await req.get("/status/api");

      await sleep(2000);

      expect([res.statusCode, res.statusText]).toEqual([200, "OK"]);

      expect(res.body).toEqual({
        module: "api",
        status: {
          request: {
            current: 2,
            unit: "count"
          },
          uploaded: {
            current: 0,
            unit: "mb"
          },
          downloaded: {
            current: 1,
            unit: "mb"
          }
        }
      });
    });
  });

  describe("Without Module", () => {
    let req: Request;
    let app: INestApplication;

    beforeEach(async () => {
      const module = await Test.createTestingModule({
        imports: [DatabaseTestingModule.standalone(), CoreTestingModule],
        controllers: [TestController]
      }).compile();

      req = module.get(Request);
      app = module.createNestApplication();

      await app.listen(req.socket);
    });

    afterEach(() => app.close());

    it("should not track request and response ", async () => {
      let res = await req.get("/test");
      expect([res.statusCode, res.statusText]).toEqual([200, "OK"]); // make sure that endpoint still works

      res = await req.get("/status/api");
      expect([res.statusCode, res.statusText]).toEqual([404, "Not Found"]);
      expect(res.body.message).toEqual("Cannot GET /status/api");
    });
  });
});
