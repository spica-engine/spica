import {Controller, INestApplication, Post, Req, UseInterceptors} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {activity, ActivityService} from "@spica-server/activity-services";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {
  Predict,
  ModuleActivity,
  ACTIVITY_OPTIONS,
  ACTIVITY_REPOSITORY,
  ActivityRepository
} from "@spica-server/interface-activity";
import {provideRepository} from "@spica-server/data";

const TestPredict: Predict = (): ModuleActivity[] => {
  return [
    {
      identifier: "test",
      action: 1,
      resource: ["test_module", "test_id"]
    }
  ];
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
  let repository: ActivityRepository;
  let insertSpy: jest.SpyInstance;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.create(), CoreTestingModule],
      controllers: [TestController],
      providers: [
        provideRepository(ACTIVITY_REPOSITORY),
        ActivityService,
        {
          provide: ACTIVITY_OPTIONS,
          useValue: {
            expireAfterSeconds: 60
          }
        }
      ]
    }).compile();

    repository = module.get(ACTIVITY_REPOSITORY);
    request = module.get(Request);
    app = module.createNestApplication();
    await app.listen(request.socket);
    insertSpy = jest.spyOn(repository, "insertMany");
  });

  beforeEach(() => {
    insertSpy.mockReset();
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

    let expectedArg = insertSpy.mock.calls[0][0][0];
    expect(expectedArg.created_at).toEqual(expect.any(Date));

    delete expectedArg.created_at;

    expect(expectedArg).toEqual({
      identifier: "test",
      action: 1,
      resource: ["test_module", "test_id"]
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
