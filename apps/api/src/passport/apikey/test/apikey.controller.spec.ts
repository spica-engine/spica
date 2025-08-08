import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "../../../../../../libs/core/testing";
import {DatabaseTestingModule, ObjectId} from "../../../../../../libs/database/testing";
import {PassportTestingModule} from "../../testing";
import {PreferenceTestingModule} from "../../../preference/testing";
import {ApiKeyModule} from "..";
import {SchemaModule} from "../../../../../../libs/core/schema";
import {OBJECT_ID} from "../../../../../../libs/core/schema/formats";

describe("ApiKey", () => {
  let req: Request;
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.standalone(),
        CoreTestingModule,
        PreferenceTestingModule,
        PassportTestingModule.initialize(),
        ApiKeyModule.forRoot({realtime: false}),
        SchemaModule.forRoot({formats: [OBJECT_ID]})
      ]
    }).compile();

    req = module.get(Request);

    app = module.createNestApplication();

    await app.listen(req.socket);
  });

  afterEach(() => app.close());

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

    it("should add apikey with id and key", async () => {
      const id = new ObjectId();
      const body = {
        _id: id,
        key: "super_secret_key",
        name: "test",
        description: "test"
      };
      const {body: apiKey} = await req.post("/passport/apikey", body);

      expect(apiKey).toEqual({...body, _id: id.toHexString(), active: true, policies: []});
    });

    it("should return validation errors", async () => {
      const {body, statusCode} = await req
        .post("/passport/apikey", {
          description: "test"
        })
        .catch(r => r);
      expect(statusCode).toBe(400);
      expect(body.error).toBe("validation failed");
      expect(body.message).toBe(" must have required property 'name'");
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
      insertedApiKey = (
        await req.post("/passport/apikey", {
          name: "test",
          active: true
        })
      ).body;
    });
    it("should delete apiKey", async () => {
      const response = await req.delete(`/passport/apikey/${insertedApiKey._id}`);
      expect([response.statusCode, response.statusText]).toEqual([204, "No Content"]);

      const apiKeys = (await req.get("/passport/apikey", {})).body;
      expect(apiKeys).toEqual({
        meta: {
          total: 0
        },
        data: []
      });
    });

    it("should throw NotFoundExpection", async () => {
      const {body} = await req.delete(`/passport/apikey/${new ObjectId()}`);
      expect([body.statusCode, body.message]).toEqual([404, "Not Found"]);

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
      const insertedApiKey = (
        await req.post("/passport/apikey", {
          name: "test"
        })
      ).body;

      const response = await req.put(`/passport/apikey/${insertedApiKey._id}/policy/test_policy`);
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({
        _id: insertedApiKey._id,
        key: insertedApiKey.key,
        name: "test",
        active: true,
        policies: ["test_policy"]
      });
    });

    it("should detach policy from apikey", async () => {
      const insertedApiKey = (
        await req.post("/passport/apikey", {
          name: "test"
        })
      ).body;

      await req.put(`/passport/apikey/${insertedApiKey._id}/policy/test_policy`);

      const response = await req.delete(
        `/passport/apikey/${insertedApiKey._id}/policy/test_policy`
      );
      expect([response.statusCode, response.statusText]).toEqual([204, "No Content"]);

      const modifiedApikey = await req.get(`/passport/apikey/${insertedApiKey._id}`);

      expect(modifiedApikey.statusCode).toBe(200);
      expect(modifiedApikey.body).toEqual({
        _id: insertedApiKey._id,
        key: insertedApiKey.key,
        name: "test",
        active: true,
        policies: []
      });
    });
  });
});
