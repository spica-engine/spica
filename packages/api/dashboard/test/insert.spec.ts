import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {OBJECT_ID, SchemaModule} from "@spica-server/core-schema";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {DashboardModule} from "@spica-server/dashboard";
import {contractSuite} from "@spica-server/database-testing";
import {PassportTestingModule} from "@spica-server/passport-testing";

contractSuite("Dashboard insert", engine => {
  let app: INestApplication;
  let req: Request;

  const dashboard = {
    name: "First Dashboard",
    icon: "offline_bolt",
    components: [{name: "chart1", url: "https://spica.internal", type: "line", ratio: "2/2"}]
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        engine.module(),
        CoreTestingModule,
        PassportTestingModule.initialize(),
        DashboardModule.forRoot({realtime: false}),
        SchemaModule.forRoot({formats: [OBJECT_ID]})
      ]
    }).compile();

    req = module.get(Request);
    app = module.createNestApplication();
    await app.listen(req.socket);
  });

  afterEach(() => app.close());

  it("should answer with the stored record", async () => {
    const {statusCode, body} = await req.post("/dashboard", dashboard);

    expect(statusCode).toBe(201);
    expect(body).toEqual({_id: expect.any(String), ...dashboard});
    expect((await req.get(`/dashboard/${body._id}`)).body).toEqual(body);
  });

  it("should keep the id the caller sends", async () => {
    const first = await req.post("/dashboard", dashboard);
    await req.delete(`/dashboard/${first.body._id}`);

    const {body} = await req.post("/dashboard", {...dashboard, _id: first.body._id});

    expect(body._id).toBe(first.body._id);
  });
});
