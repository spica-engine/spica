import {CallHandler, ExecutionContext, INestApplication, NestInterceptor} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {ActivityServicesModule} from "@spica-server/activity-services";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {OBJECT_ID, SchemaModule} from "@spica-server/core-schema";
import {contractSuite} from "@spica-server/database-testing";
import {ACTIVITY_REPOSITORY} from "@spica-server/interface-activity";
import {ID_TYPES, IdTypes} from "@spica-server/interface-data";
import {PassportTestingModule} from "@spica-server/passport-testing";
import {EnvVarModule} from "../src";

class IdentifiedUser implements NestInterceptor {
  constructor(private readonly id: string) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    request.user = {...request.user, _id: this.id};
    return next.handle();
  }
}

contractSuite("Environment Variable insert", engine => {
  let module: TestingModule;
  let app: INestApplication;
  let req: Request;
  let insertedActivities: jest.SpyInstance;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        engine.module(),
        ActivityServicesModule.forRoot({expireAfterSeconds: 60}),
        CoreTestingModule,
        EnvVarModule.forRoot({realtime: false}),
        SchemaModule.forRoot({formats: [OBJECT_ID]}),
        PassportTestingModule.initialize({overriddenStrategyType: "JWT"})
      ]
    }).compile();

    req = module.get(Request);
    insertedActivities = jest.spyOn(module.get(ACTIVITY_REPOSITORY), "insertMany");

    app = module.createNestApplication();
    const identityId = module.get<IdTypes>(ID_TYPES).forCollection("identity").generate();
    app.useGlobalInterceptors(new IdentifiedUser(String(identityId)));
    await app.listen(req.socket);
  });

  afterEach(() => app.close());

  async function nextActivity() {
    for (let attempt = 0; attempt < 50 && !insertedActivities.mock.calls.length; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    return insertedActivities.mock.calls[0]?.[0];
  }

  it("should answer with the stored record", async () => {
    const {statusCode, body} = await req.post("/env-var", {key: "ENV_KEY", value: "123"});

    expect(statusCode).toBe(201);
    expect(body).toEqual({
      _id: expect.any(String),
      key: "ENV_KEY",
      value: "123",
      updated_at: expect.any(String)
    });
    expect((await req.get(`/env-var/${body._id}`)).body).toEqual(body);
  });

  it("should write the activity of the new record", async () => {
    const {body} = await req.post("/env-var", {key: "ENV_KEY", value: "123"});

    const activities = await nextActivity();

    expect(activities).toHaveLength(1);
    expect(activities[0].resource).toEqual(["env_var", body._id]);
  });
});
