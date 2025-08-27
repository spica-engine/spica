import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {OBJECT_ID} from "@spica-server/core/schema/formats";
import {EnvVarModule} from "../src";
import {PassportTestingModule} from "@spica-server/passport/testing";

describe("Environment Variable", () => {
  let req: Request;
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.standalone(),
        CoreTestingModule,
        EnvVarModule.forRoot({realtime: false}),
        SchemaModule.forRoot({formats: [OBJECT_ID]}),
        PassportTestingModule.initialize({overriddenStrategyType: "JWT"})
      ]
    }).compile();

    req = module.get(Request);

    app = module.createNestApplication();

    await app.listen(req.socket);
  });

  afterEach(() => app.close());

  describe("find", () => {
    it("should return all envs", async () => {
      const envVar = {key: "ENV_KEY", value: "123"};

      await req.post("/env-var", envVar);

      const res = await req.get("/env-var");
      const bodyWithoutIds = res.body.map(({_id, ...rest}) => rest);
      expect(bodyWithoutIds).toEqual([envVar]);
    });

    it("should support limit, skip and sort ", async () => {
      const envVar1 = {key: "ENV_KEY_1", value: "200"};
      const envVar2 = {key: "ENV_KEY_2", value: "300"};
      const envVar3 = {key: "ENV_KEY_3", value: "100"};

      await req.post("/env-var", envVar1);
      await req.post("/env-var", envVar2);
      await req.post("/env-var", envVar3);

      const resSkip = await req.get(`/env-var`, {
        skip: 1,
        limit: 1,
        sort: JSON.stringify({value: -1})
      });
      const bodySkip = resSkip.body.map(({_id, ...rest}) => rest);
      expect(bodySkip).toEqual([envVar1]);
    });

    it("should paginate", async () => {
      const envVar1 = {key: "ENV_KEY_1", value: "val_1"};
      const envVar2 = {key: "ENV_KEY_2", value: "val_2"};
      const envVar3 = {key: "ENV_KEY_3", value: "val_3"};

      await Promise.all([
        req.post("/env-var", envVar1),
        req.post("/env-var", envVar2),
        req.post("/env-var", envVar3)
      ]);

      const res = await req.get(`/env-var`, {paginate: true, sort: JSON.stringify({_id: -1})});
      const bodyWithoutIds = {...res.body, data: res.body.data.map(({_id, ...rest}) => rest)};
      expect(bodyWithoutIds).toEqual({
        meta: {total: 3},
        data: [envVar3, envVar2, envVar1]
      });
    });

    it("should filter", async () => {
      const envVar1 = {key: "ENV_KEY_1", value: "val_1"};
      const envVar2 = {key: "ENV_KEY_2", value: "val_2"};
      const envVar3 = {key: "ENV_KEY_2", value: "val_3"};

      await Promise.all([
        req.post("/env-var", envVar1),
        req.post("/env-var", envVar2),
        req.post("/env-var", envVar3)
      ]);

      const res = await req.get(`/env-var`, {filter: JSON.stringify({key: "ENV_KEY_2"})});
      const bodyWithoutIds = res.body.map(({_id, ...rest}) => rest);
      expect(bodyWithoutIds.length).toBe(2);
      expect(bodyWithoutIds).toEqual(expect.arrayContaining([envVar2, envVar3]));

      const res2 = await req.get(`/env-var`, {filter: JSON.stringify({value: "val_2"})});
      const bodyWithoutIds2 = res2.body.map(({_id, ...rest}) => rest);
      expect(bodyWithoutIds2).toEqual([envVar2]);
    });
  });

  describe("findOne", () => {
    it("should return env by id", async () => {
      const envVar = {key: "ENV_KEY", value: "123"};

      const {body} = await req.post("/env-var", envVar);

      const res = await req.get(`/env-var/${body._id}`);
      delete res.body._id;
      expect(res.body).toEqual(envVar);
    });
  });

  describe("insertOne", () => {
    const envVar = {key: "ENV_KEY", value: "123"};

    it("should add new env", async () => {
      const {body} = await req.post("/env-var", envVar);

      expect(body._id).not.toBeFalsy();
      expect(body.key).toBe("ENV_KEY");
      expect(body.value).toBe("123");

      const res = await req.get(`/env-var/${body._id}`);
      delete res.body._id;
      expect(res.body).toEqual(envVar);
    });

    it("should return validation errors", async () => {
      const {body, statusCode} = await req
        .post("/env-var", {
          key: "value"
        })
        .catch(r => r);

      expect(statusCode).toBe(400);
      expect(body.error).toBe("validation failed");
      expect(body.message).toBe(" must have required property 'value'");
    });
  });

  describe("updateOne", () => {
    it("should update env", async () => {
      const {body} = await req.post("/env-var", {key: "ENV_KEY", value: "123"});

      await req.put(`/env-var/${body._id}`, {
        key: "ENV_KEY",
        value: "456"
      });

      const res = await req.get(`/env-var/${body._id}`);

      expect(res.body._id).not.toBeFalsy();
      expect(res.body.key).toBe("ENV_KEY");
      expect(res.body.value).toBe("456");
    });

    it("should not update and return 404", async () => {
      const res = await req
        .post(`/env-var/${ObjectId.createFromTime(Date.now())}`, {
          key: "ENV_KEY",
          value: "123"
        })
        .catch(r => r);

      expect(res.statusCode).toBe(404);
    });
  });

  describe("delete", () => {
    it("should delete env", async () => {
      const {body} = await req.post("/env-var", {
        key: "ENV_KEY",
        value: "123"
      });

      const res = await req.delete(`/env-var/${body._id}`);
      expect([res.statusCode, res.statusText]).toEqual([204, "No Content"]);

      const {body: envVars} = await req.get("/env-var");
      expect(envVars.length).toEqual(0);
    });
  });
});
