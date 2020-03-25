import {Controller, Post, UseInterceptors, INestApplication} from "@nestjs/common";
import {Predict, Resource, ActivityService, activity} from "@spica-server/activity/src";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";

const mockPredict: Predict = (action, req, res): Resource => {
  return {documentId: ["test_id"], name: "test_module"};
};

@Controller("test")
export class mockController {
  constructor() {}

  @UseInterceptors(activity(mockPredict))
  @Post()
  insert() {
    return "test";
  }
}

describe("Interceptor Integration", () => {
  describe("Disabled activity stream", () => {
    let request: Request;
    let app: INestApplication;

    beforeAll(async () => {
      const module = await Test.createTestingModule({
        imports: [CoreTestingModule],
        controllers: [mockController]
      }).compile();

      request = module.get(Request);

      app = module.createNestApplication();

      await app.listen(request.socket);
    });

    it("should run even if there is no activity service provider ", async () => {
      const res = await request.post("/test");

      expect(res.statusCode).toEqual(201);
      expect(res.statusText).toEqual("Created");
      expect(res.body).toEqual("test");
    });

    afterAll(async () => {
      await app.close();
    });
  });

  describe("Enabled activity stream", () => {
    let request: Request;
    let app: INestApplication;
    let service: ActivityService;
    let insertSpy: jasmine.Spy;

    beforeAll(async () => {
      const module = await Test.createTestingModule({
        imports: [DatabaseTestingModule.create(), CoreTestingModule],
        controllers: [mockController],
        providers: [ActivityService]
      }).compile();

      service = module.get(ActivityService);

      request = module.get(Request);

      app = module.createNestApplication();

      await app.listen(request.socket);
    });

    it("should not insert an activity if user isn't exist", async () => {
      insertSpy = spyOn(service, "insertOne");

      const res = await request.post("/test");

      expect(res.statusCode).toEqual(201);
      expect(res.statusText).toEqual("Created");
      expect(res.body).toEqual("test");

      expect(insertSpy).toHaveBeenCalledTimes(0);
    });

    afterAll(async () => {
      await app.close();
    });
  });
});
