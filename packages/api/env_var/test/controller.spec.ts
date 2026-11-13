import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {contractSuite, waitForMongoIndexes} from "@spica-server/database-testing";
import {ID_TYPES, IdTypes} from "@spica-server/interface-data";
import {SchemaModule} from "@spica-server/core-schema";
import {OBJECT_ID} from "@spica-server/core-schema";
import {EnvVarModule} from "../src";
import {PassportTestingModule} from "@spica-server/passport-testing";
import {idOf, stripId, systemKeyField, omitId} from "@spica-server/data";

contractSuite("Environment Variable", engine => {
  let req: Request;
  let app: INestApplication;
  let missingId: () => string;

  const postgres = engine.name == "postgresql";
  const filterOn = (field: string, value: string) =>
    postgres ? `document.${field} == '${value}'` : JSON.stringify({[field]: value});
  const filterOtherLanguage = (field: string, value: string) =>
    postgres ? JSON.stringify({[field]: value}) : `document.${field} == '${value}'`;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        engine.module(),
        CoreTestingModule,
        EnvVarModule.forRoot({realtime: false}),
        SchemaModule.forRoot({formats: [OBJECT_ID]}),
        PassportTestingModule.initialize({overriddenStrategyType: "JWT"})
      ]
    }).compile();
    await waitForMongoIndexes(engine, module, {env_var: ["key_1"]});

    req = module.get(Request);
    missingId = () => String(module.get<IdTypes>(ID_TYPES).forCollection("env_var").generate());

    app = module.createNestApplication();

    await app.listen(req.socket);
  });

  afterEach(() => app.close());

  describe("find", () => {
    it("should return all envs", async () => {
      const envVar = {key: "ENV_KEY", value: "123"};

      await req.post("/env-var", envVar);

      const res = await req.get("/env-var");
      const bodyWithoutIds = res.body.map(({updated_at, ...rest}) => omitId(rest));
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
      const bodySkip = resSkip.body.map(({updated_at, ...rest}) => omitId(rest));
      expect(bodySkip).toEqual([envVar1]);
    });

    it("should paginate", async () => {
      const envVar1 = {key: "ENV_KEY_1", value: "val_1"};
      const envVar2 = {key: "ENV_KEY_2", value: "val_2"};
      const envVar3 = {key: "ENV_KEY_3", value: "val_3"};

      for (const envVar of [envVar1, envVar2, envVar3]) {
        await req.post("/env-var", envVar);
      }

      const res = await req.get(`/env-var`, {
        paginate: true,
        sort: JSON.stringify({[systemKeyField()]: -1})
      });
      const bodyWithoutIds = {
        ...res.body,
        data: res.body.data.map(({updated_at, ...rest}) => omitId(rest))
      };
      expect(bodyWithoutIds).toEqual({
        meta: {total: 3},
        data: [envVar3, envVar2, envVar1]
      });
    });

    it("should filter", async () => {
      const envVar1 = {key: "ENV_KEY_1", value: "val_1"};
      const envVar2 = {key: "ENV_KEY_2", value: "val_2"};
      const envVar3 = {key: "ENV_KEY_3", value: "val_3"};

      await Promise.all([
        req.post("/env-var", envVar1),
        req.post("/env-var", envVar2),
        req.post("/env-var", envVar3)
      ]);

      const res = await req.get(`/env-var`, {filter: filterOn("key", "ENV_KEY_3")});
      const bodyWithoutIds = res.body.map(({updated_at, ...rest}) => omitId(rest));
      expect(bodyWithoutIds.length).toBe(1);
      expect(bodyWithoutIds).toEqual([envVar3]);

      const res2 = await req.get(`/env-var`, {filter: filterOn("value", "val_2")});
      const bodyWithoutIds2 = res2.body.map(({updated_at, ...rest}) => omitId(rest));
      expect(bodyWithoutIds2).toEqual([envVar2]);
    });

    it("should answer 404 for a filter in the other engine's language", async () => {
      const res = await req.get(`/env-var`, {filter: filterOtherLanguage("key", "ENV_KEY_3")});
      expect(res.statusCode).toEqual(404);
    });

    it("should answer 400 for broken json", async () => {
      const res = await req.get(`/env-var`, {filter: '{"key": '});
      expect(res.statusCode).toEqual(400);
    });
  });

  describe("findOne", () => {
    it("should return env by id", async () => {
      const envVar = {key: "ENV_KEY", value: "123"};

      const {body} = await req.post("/env-var", envVar);

      const res = await req.get(`/env-var/${idOf(body)}`);
      stripId(res.body);
      delete res.body.updated_at;
      expect(res.body).toEqual(envVar);
    });
  });

  describe("insertOne", () => {
    const envVar = {key: "ENV_KEY", value: "123"};

    it("should add new env", async () => {
      const {body} = await req.post("/env-var", envVar);

      expect(idOf(body)).not.toBeFalsy();
      expect(body.key).toBe("ENV_KEY");
      expect(body.value).toBe("123");

      const res = await req.get(`/env-var/${idOf(body)}`);
      stripId(res.body);
      delete res.body.updated_at;
      expect(res.body).toEqual(envVar);
    });

    it("should set updated_at on insert", async () => {
      const {body} = await req.post("/env-var", envVar);
      expect(body.updated_at).not.toBeFalsy();
      expect(new Date(body.updated_at).toString()).not.toBe("Invalid Date");
    });

    it("should ignore client-sent updated_at and unknown fields", async () => {
      const clientTimestamp = new Date("2000-01-01T00:00:00.000Z").toISOString();
      const {body, statusCode} = await req.post("/env-var", {
        key: "ENV_KEY",
        value: "123",
        updated_at: clientTimestamp,
        injected: "should-be-dropped"
      });

      expect(statusCode).toBe(201);
      expect(body.updated_at).not.toBe(clientTimestamp);
      expect(body.injected).toBeUndefined();

      const res = await req.get(`/env-var/${idOf(body)}`);
      expect(res.body.injected).toBeUndefined();
      expect(Object.keys(res.body).sort()).toEqual(
        [systemKeyField(), "key", "updated_at", "value"].sort()
      );
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

      await req.put(`/env-var/${idOf(body)}`, {
        key: "ENV_KEY",
        value: "456"
      });

      const res = await req.get(`/env-var/${idOf(body)}`);

      expect(idOf(res.body)).not.toBeFalsy();
      expect(res.body.key).toBe("ENV_KEY");
      expect(res.body.value).toBe("456");
    });

    it("should advance updated_at on update", async () => {
      const {body} = await req.post("/env-var", {key: "ENV_KEY", value: "123"});

      const {body: updated} = await req.put(`/env-var/${idOf(body)}`, {
        key: "ENV_KEY",
        value: "456"
      });

      expect(new Date(updated.updated_at).getTime()).toBeGreaterThanOrEqual(
        new Date(body.updated_at).getTime()
      );
    });

    it("should not update and return 404", async () => {
      const res = await req
        .post(`/env-var/${missingId()}`, {
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

      const res = await req.delete(`/env-var/${idOf(body)}`);
      expect([res.statusCode, res.statusText]).toEqual([204, "No Content"]);

      const {body: envVars} = await req.get("/env-var");
      expect(envVars.length).toEqual(0);
    });
  });
});
