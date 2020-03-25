import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {PassportModule} from "@spica-server/passport";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";

describe("ApiKey", () => {
  let req: Request;
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.create(),
        CoreTestingModule,
        PreferenceTestingModule,
        PassportModule.forRoot({
          issuer: "spica.internal",
          secretOrKey: "test",
          defaultStrategy: "noop"
        }),
        PassportTestingModule.initialize()
      ]
    }).compile();

    req = module.get(Request);

    app = module.createNestApplication();

    await app.listen(req.socket);
  });

  afterEach(async () => await app.close());

  describe("find", () => {
    it("should return empty index", async () => {
      const res = await req.get("/passport/apikey", undefined);
      expect(res.body).toEqual({
        meta: {total: 0},
        data: []
      });
    });

    it("should not return empty index", async () => {
      const {body: apiKey} = await req.post("/passport/apikey", {
        name: "test",
        description: "test"
      });
      const res = await req.get("/passport/apikey", undefined);
      expect(res.body).toEqual({
        data: [apiKey],
        meta: {total: 1}
      });
    });

    it("should sort", async () => {
      const {body: firstKey} = await req.post("/passport/apikey", {
        name: "test",
        description: "test"
      });

      const {body: secondKey} = await req.post("/passport/apikey", {
        name: "test1",
        description: "test1"
      });

      const {body: keys} = await req.get(`/passport/apikey`, {sort: JSON.stringify({name: -1})});

      expect(keys).toEqual({
        meta: {total: 2},
        data: [secondKey, firstKey]
      });
    });

    it("should skip", async () => {
      await req.post("/passport/apikey", {
        name: "test",
        description: "test"
      });

      const {body: secondKey} = await req.post("/passport/apikey", {
        name: "test1",
        description: "test1"
      });

      const {body: keys} = await req.get(`/passport/apikey`, {skip: 1});

      expect(keys).toEqual({
        meta: {total: 2},
        data: [secondKey]
      });
    });

    it("should limit", async () => {
      const {body: firstKey} = await req.post("/passport/apikey", {
        name: "test",
        description: "test"
      });

      await req.post("/passport/apikey", {
        name: "test1",
        description: "test1"
      });

      const {body: keys} = await req.get(`/passport/apikey`, {limit: 1});

      expect(keys).toEqual({
        meta: {total: 2},
        data: [firstKey]
      });
    });
  });

  describe("findOne", () => {
    it("should return the apikey", async () => {
      const {body: insertedApiKey} = await req.post("/passport/apikey", {
        name: "test",
        description: "test"
      });
      const {body: apiKey} = await req.get(`/passport/apikey/${insertedApiKey._id}`, undefined);
      expect(apiKey).toEqual(insertedApiKey);
    });

    it("should return 404", async () => {
      const res = await req
        .get(`/passport/apikey/${ObjectId.createFromTime(Date.now())}`, undefined)
        .catch(r => r);
      expect(res.statusCode).toBe(404);
    });
  });

  describe("insertOne", () => {
    it("should add new apikey", async () => {
      const {body: apiKey} = await req.post("/passport/apikey", {
        name: "test",
        description: "test"
      });

      expect(apiKey._id).not.toBeFalsy();
      expect(apiKey.name).toBe("test");
      expect(apiKey.description).toBe("test");
      expect(apiKey.key).not.toBeFalsy();
      expect(apiKey.active).toBe(true);
    });

    it("should return validation errors", async () => {
      const {body, statusCode} = await req
        .post("/passport/apikey", {
          description: "test"
        })
        .catch(r => r);
      expect(body.error).toBe(" should have required property 'name'");
      expect(statusCode).toBe(400);
    });
  });

  describe("updateOne", () => {
    it("should update the apiKey", async () => {
      const {body} = await req.post("/passport/apikey", {
        name: "test",
        description: "test"
      });

      const {body: updatedBody} = await req.put(`/passport/apikey/${body._id}`, {
        name: "test1",
        description: "test1",
        active: false
      });

      expect(updatedBody._id).not.toBeFalsy();
      expect(updatedBody.name).toBe("test1");
      expect(updatedBody.description).toBe("test1");
      expect(updatedBody.key).not.toBeFalsy();
      expect(updatedBody.active).toBe(false);
    });

    it("should not update and return 404", async () => {
      const res = await req
        .post(`/passport/apikey/${ObjectId.createFromTime(Date.now())}`, {
          name: "test1",
          description: "test1",
          active: false
        })
        .catch(r => r);

      expect(res.statusCode).toBe(404);
    });
  });

  describe("delete", () => {
    let insertedApiKey;
    beforeEach(async () => {
      insertedApiKey = (await req.post("/passport/apikey", {
        name: "test",
        policies: [],
        active: true
      })).body;
    });
    it("should delete apiKey", async () => {
      const response = await req.delete(`/passport/apikey/${insertedApiKey._id}`);
      expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);

      const apiKeys = (await req.get("/passport/apikey", {})).body;
      expect(apiKeys).toEqual({
        meta: {
          total: 0
        },
        data: []
      });
    });

    it("should throw NotFoundExpection", async () => {
      const responseBody = (await req.delete(`/passport/apikey/${new ObjectId()}`)).body;
      expect([responseBody.statusCode, responseBody.error]).toEqual([404, "Not Found"]);

      const apiKeys = (await req.get("/passport/apikey", {})).body;
      expect(apiKeys).toEqual({
        meta: {
          total: 1
        },
        data: [insertedApiKey]
      });
    });
  });

  describe("attach/detach", () => {
    it("should attach policy to apikey", async () => {
      const insertedApiKey = (await req.post("/passport/apikey", {
        name: "test"
      })).body;

      const response = await req.put(`/passport/apikey/${insertedApiKey._id}/attach-policy`, [
        "test policy",
        "another policy"
      ]);
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({
        _id: insertedApiKey._id,
        key: insertedApiKey.key,
        name: "test",
        active: true,
        policies: ["test policy", "another policy"]
      });
    });

    it("should detach policy from apikey", async () => {
      const insertedApiKey = (await req.post("/passport/apikey", {
        name: "test"
      })).body;

      await req.put(`/passport/apikey/${insertedApiKey._id}/attach-policy`, [
        "test policy",
        "another policy"
      ]);

      const response = await req.put(`/passport/apikey/${insertedApiKey._id}/detach-policy`, [
        "test policy"
      ]);
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({
        _id: insertedApiKey._id,
        key: insertedApiKey.key,
        name: "test",
        active: true,
        policies: ["another policy"]
      });
    });

    it("should throw error if policies which will be attached are duplicated", async () => {
      const insertedApiKey = (await req.post("/passport/apikey", {
        name: "test"
      })).body;

      const responseBody = (await req.put(`/passport/apikey/${insertedApiKey._id}/attach-policy`, [
        "test policy",
        "test policy",
        "another policy"
      ])).body;

      expect([responseBody.statusCode, responseBody.error, responseBody.message]).toEqual([
        400,
        " should NOT have duplicate items (items ## 1 and 0 are identical)",
        "validation failed"
      ]);
    });

    it("should throw error if policies which will be detached are duplicated", async () => {
      const insertedApiKey = (await req.post("/passport/apikey", {
        name: "test"
      })).body;

      const responseBody = (await req.put(`/passport/apikey/${insertedApiKey._id}/detach-policy`, [
        "test policy",
        "test policy",
        "another policy"
      ])).body;

      expect([responseBody.statusCode, responseBody.error, responseBody.message]).toEqual([
        400,
        " should NOT have duplicate items (items ## 1 and 0 are identical)",
        "validation failed"
      ]);
    });

    it("should throw error if apikey id on attach request is nonexist", async () => {
      await req.post("/passport/apikey", {
        name: "test"
      });

      const responseBody = (await req.put(`/passport/apikey/${new ObjectId()}/attach-policy`, [
        "another policy"
      ])).body;

      expect([responseBody.statusCode, responseBody.error]).toEqual([404, "Not Found"]);
    });

    it("should throw error if apikey id on detach request is nonexist", async () => {
      await req.post("/passport/apikey", {
        name: "test",
        policies: ["test policy"]
      });

      const responseBody = (await req.put(`/passport/apikey/${new ObjectId()}/detach-policy`, [
        "another policy"
      ])).body;

      expect([responseBody.statusCode, responseBody.error]).toEqual([404, "Not Found"]);
    });
  });
});
