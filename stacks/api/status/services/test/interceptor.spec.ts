import {Controller, Get, INestApplication, Post} from "@nestjs/common";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {Middlewares} from "@spica-server/core";
import {StatusModule} from "@spica-server/status";
import {StatusService} from "@spica-server/status/services";
import {Test} from "@nestjs/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";

const MbInKb = 1000 * 1000;

@Controller("test")
export class TestController {
  constructor() {}

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
    let statusService: StatusService;

    beforeAll(async () => {
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

      statusService = module.get(StatusService);

      app = module.createNestApplication();
      await app.init();

      app.use(Middlewares.JsonBodyParser({limit: 3 * MbInKb, ignoreUrls: []}));

      await app.listen(req.socket);
    });

    afterAll(async () => {
      await app.close();
    });

    afterEach(async () => {
      await statusService._coll.drop();
    });

    function onStatusInserted() {
      return new Promise((resolve, reject) => {
        const originalInsert = statusService.insertOne;
        statusService.insertOne = (...args) => {
          return originalInsert
            .bind(statusService)(...args)
            .then(r => {
              resolve(args);
              return r;
            });
        };
      });
    }

    it("should get request-response statistics for get request", done => {
      onStatusInserted().then(() => {
        req.get("/status/api").then(res => {
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
          done();
        });
      });

      req.get("/test");
    });

    it("should get request-response statistics for post request", done => {
      onStatusInserted().then(() => {
        req.get("/status/api").then(res => {
          expect([res.statusCode, res.statusText]).toEqual([200, "OK"]);
          expect(res.body).toEqual({
            module: "api",
            status: {
              request: {
                current: 1,
                unit: "count"
              },
              uploaded: {
                current: 0.1,
                unit: "mb"
              },
              downloaded: {
                current: 1,
                unit: "mb"
              }
            }
          });

          done();
        });
      });
      req.post("/test", {message: "a".repeat(100000)});
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
