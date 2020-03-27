import {Controller, INestApplication, Post, Req, UseInterceptors} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {activity, ActivityService, Predict, Resource} from "@spica-server/activity";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";

const TestPredict: Predict = (): Resource => {
  return {documentId: ["test_id"], name: "test_module"};
};

@Controller("test")
export class TestController {
  constructor() {}

  @UseInterceptors(activity(TestPredict))
  @Post()
  insert() {
    return "test";
  }

  @UseInterceptors(activity(TestPredict))
  @Post("withuser")
  insertWithUser(@Req() req) {
    req.user = {
      _id: "test"
    };
    return "test";
  }
}

describe("Interceptor with a proper activity handler", () => {
  let request: Request;
  let app: INestApplication;
  let service: ActivityService;
  let insertSpy: jasmine.Spy;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.create(), CoreTestingModule],
      controllers: [TestController],
      providers: [ActivityService]
    }).compile();

    service = module.get(ActivityService);
    request = module.get(Request);
    app = module.createNestApplication();
    await app.listen(request.socket);
    insertSpy = spyOn(service, "insertOne");
  });

  beforeEach(() => {
    insertSpy.calls.reset();
  });

  afterAll(async () => await app.close());

  it("should not insert an activity if the user does not exist", async () => {
    const res = await request.post("/test");

    expect(res.statusCode).toEqual(201);
    expect(res.statusText).toEqual("Created");
    expect(res.body).toEqual("test");
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("should insert an activity", async () => {
    await request.post("/test/withuser");
    expect(insertSpy).toHaveBeenCalledWith({
      identifier: "test",
      action: 1,
      resource: {documentId: ["test_id"], name: "test_module"}
    });
  });
});

describe("Interceptor without a proper activity handler", () => {
  let request: Request;
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [CoreTestingModule],
      controllers: [TestController]
    }).compile();

    request = module.get(Request);

    app = module.createNestApplication();

    await app.listen(request.socket);
  });

  afterAll(async () => await app.close());

  it("should not disrupt the controller", async () => {
    const res = await request.post("/test");
    expect(res.statusCode).toEqual(201);
    expect(res.statusText).toEqual("Created");
    expect(res.body).toEqual("test");
  });
});
