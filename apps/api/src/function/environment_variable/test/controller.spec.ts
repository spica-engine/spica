import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {OBJECT_ID} from "@spica-server/core/schema/formats";
import {EnvironmentVariableModule} from "../src";

describe("Environment Variable", () => {
  let req: Request;
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.standalone(),
        CoreTestingModule,
        EnvironmentVariableModule.forRoot(),
        SchemaModule.forRoot({formats: [OBJECT_ID]})
      ]
    }).compile();

    req = module.get(Request);

    app = module.createNestApplication();

    await app.listen(req.socket);
  });

  afterEach(() => app.close());

  describe("find", () => {
    it("should return all envs", async () => {
      const {body} = await req.post("/function-env", {
        key: "ENV_KEY",
        value: "123"
      });

      const res = await req.get("/function-env");
      expect(res.body).toEqual([body]);
    });

    it("should limit", async () => {
      const env1 = await req.post("/function-env", {key: "ENV_KEY_1", value: "123"});
      const env2 = await req.post("/function-env", {key: "ENV_KEY_2", value: "1234"});
      await req.post("/function-env", {key: "ENV_KEY_3", value: "123"});

      const res = await req.get(`/function-env`, {limit: 2});
      expect(res.body.length).toEqual(2);
      expect(res.body).toEqual([env1.body, env2.body]);
    });

    it("should skip", async () => {
      await req.post("/function-env", {key: "ENV_KEY_1", value: "123"});
      const env2 = await req.post("/function-env", {key: "ENV_KEY_2", value: "1234"});

      const res = await req.get(`/function-env`, {skip: 1});

      expect(res.body).toEqual([env2.body]);
    });

    it("should sort", async () => {
      const env1 = await req.post("/function-env", {key: "ENV_KEY_1", value: "200"});
      const env3 = await req.post("/function-env", {key: "ENV_KEY_3", value: "100"});
      const env2 = await req.post("/function-env", {key: "ENV_KEY_2", value: "300"});

      const res = await req.get(`/function-env`, {sort: JSON.stringify({value: -1})});
      expect(res.body).toEqual([env2.body, env1.body, env3.body]);
    });

    it("should paginate", async () => {
      const env1 = await req.post("/function-env", {key: "ENV_KEY_1", value: "val_1"});
      const env2 = await req.post("/function-env", {key: "ENV_KEY_2", value: "val_2"});
      const env3 = await req.post("/function-env", {key: "ENV_KEY_3", value: "val_3"});

      const res = await req.get(`/function-env`, {paginate: true});
      expect(res.body).toEqual({
        meta: {total: 3},
        data: [env1.body, env2.body, env3.body]
      });
    });

    it("should filter", async () => {
      await req.post("/function-env", {key: "ENV_KEY_1", value: "val_1"});
      const env2 = await req.post("/function-env", {key: "ENV_KEY_2", value: "val_2"});
      const env3 = await req.post("/function-env", {key: "ENV_KEY_2", value: "val_3"});

      const res = await req.get(`/function-env`, {filter: JSON.stringify({key: "ENV_KEY_2"})});
      expect(res.body).toEqual([env2.body, env3.body]);

      const res2 = await req.get(`/function-env`, {filter: JSON.stringify({value: "val_2"})});
      expect(res2.body).toEqual([env2.body]);
    });
  });

  describe("findOne", () => {
    it("should return env by id", async () => {
      const {body} = await req.post("/function-env", {
        key: "ENV_KEY",
        value: "123"
      });

      const res = await req.get(`/function-env/${body._id}`);
      expect(res.body).toEqual(body);
    });
  });

  describe("insertOne", () => {
    it("should add new env", async () => {
      const {body} = await req.post("/function-env", {
        key: "ENV_KEY",
        value: "123"
      });

      expect(body._id).not.toBeFalsy();
      expect(body.key).toBe("ENV_KEY");
      expect(body.value).toBe("123");

      const res = await req.get(`/function-env/${body._id}`);
      expect(res.body).toEqual(body);
    });

    it("should return validation errors", async () => {
      const {body, statusCode} = await req
        .post("/function-env", {
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
      const {body} = await req.post("/function-env", {
        key: "ENV_KEY",
        value: "123"
      });

      const {body: updatedBody} = await req.put(`/function-env/${body._id}`, {
        key: "ENV_KEY",
        value: "456"
      });

      expect(updatedBody._id).not.toBeFalsy();
      expect(updatedBody.key).toBe("ENV_KEY");
      expect(updatedBody.value).toBe("456");
    });

    it("should not update and return 404", async () => {
      const res = await req
        .post(`/function-env/${ObjectId.createFromTime(Date.now())}`, {
          key: "ENV_KEY",
          value: "123"
        })
        .catch(r => r);

      expect(res.statusCode).toBe(404);
    });
  });

  describe("delete", () => {
    it("should delete env", async () => {
      const {body} = await req.post("/function-env", {
        key: "ENV_KEY",
        value: "123"
      });

      const res = await req.delete(`/function-env/${body._id}`);
      expect([res.statusCode, res.statusText]).toEqual([200, "OK"]);

      const {body: envBody} = await req.get("/function-env");
      expect(envBody.length).toEqual(0);
    });

    it("should throw NotFoundExpection", async () => {
      await req.post("/function-env", {
        key: "ENV_KEY",
        value: "123"
      });

      const res = await req.delete(`/function-env/${new ObjectId()}`);
      expect([res.body.statusCode, res.body.message]).toEqual([404, "Not Found"]);

      const {body} = await req.get("/function-env");
      expect(body.length).toEqual(1);
    });
  });
});
