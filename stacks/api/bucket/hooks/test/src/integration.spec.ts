import {Middlewares} from "@spica-server/core";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule, stream} from "@spica-server/database/testing";
import {PassportModule} from "@spica-server/passport";
import {BucketModule} from "@spica-server/bucket";
import {FunctionModule} from "@spica-server/function";
import {Test, TestingModule} from "@nestjs/testing";
import {INestApplication} from "@nestjs/common";
import {Bucket, BucketDocument} from "@spica-server/bucket/services";
import {ApiKey} from "@spica-server/passport/apikey/interface";
import {Function} from "@spica-server/function/src/interface";

process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:6798";

describe("Hooks Integration", () => {
  let app: INestApplication;
  let req: Request;
  let module: TestingModule;

  let token: string;

  let bucket: Bucket;
  let user1: BucketDocument;
  let user2: BucketDocument;

  let apikey: ApiKey;

  let fn: Function;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        BucketModule.forRoot({hooks: true, history: false, realtime: false}),
        FunctionModule.forRoot({
          path: "/tmp",
          databaseName: "spica",
          poolSize: 1,
          databaseReplicaSet: "test",
          databaseUri: "mongodb://localhost:27017"
        }),
        PassportModule.forRoot({
          issuer: "spica.internal",
          secretOrKey: "test",
          publicUrl: "http://localhost:4300",
          defaultPassword: "spica",
          audience: "spica.io"
        }),
        CoreTestingModule,
        DatabaseTestingModule.replicaSet()
      ]
    }).compile();

    app = module.createNestApplication();
    req = module.get(Request);
    app.use(Middlewares.MergePatchJsonParser);
    await app.listen(req.socket);

    //wait until module initialized
    await stream.wait();

    token = await req
      .get("/passport/identify", {identifier: "spica", password: "spica"})
      .then(res => res.body.token);

    apikey = await req
      .post("/passport/apikey", {name: "test", description: "test"}, {Authorization: token})
      .then(res => res.body);

    await req.put(`/passport/apikey/${apikey._id}/attach-policy`, ["BucketFullAccess"], {
      Authorization: token
    });

    bucket = {
      title: "New Bucket",
      description: "Describe your new bucket",
      primary: "title",
      properties: {
        username: {
          type: "string",
          options: {position: "left"}
        },
        password: {
          type: "string",
          options: {position: "right"}
        },
        age: {
          type: "number",
          options: {position: "right"}
        }
      }
    };
    bucket = await req.post("/bucket", bucket, {Authorization: token}).then(res => res.body);

    jasmine.addCustomEqualityTester((actual, expected) => {
      if (expected == "__skip__" && typeof actual == typeof expected) {
        return true;
      }
    });
  }, 20000);

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    user1 = await req
      .post(
        `/bucket/${bucket._id}/data`,
        {username: "test_user1", password: "test_password1", age: 30},
        {Authorization: token}
      )
      .then(res => res.body);

    user2 = await req
      .post(
        `/bucket/${bucket._id}/data`,
        {username: "test_user2", password: "test_password2", age: 19},
        {Authorization: token}
      )
      .then(res => res.body);
  });

  afterEach(async () => {
    await req.delete(`/bucket/${bucket._id}/data`, [user1._id, user2._id], {Authorization: token});
  });

  describe("GET", () => {
    beforeAll(async () => {
      fn = {
        name: "test",
        description: "test",
        triggers: {
          default: {
            options: {
              bucket: bucket._id,
              type: "GET"
            },
            type: "bucket",
            active: true
          }
        },
        env: {}
      };
      fn = await req.post("/function", fn, {Authorization: token}).then(res => res.body);
    });

    afterAll(async () => {
      await req.delete(`/function/${fn._id}`, {}, {Authorization: token});
    });

    it("should not change the behaviour of bucket-data endpoint", async () => {
      let index = `export default function(request){
        return [];
      }`;
      await req.post(`/function/${fn._id}/index`, {index}, {Authorization: token});

      let {body: document} = await req.get(
        `/bucket/${bucket._id}/data/${user1._id}`,
        {},
        {Authorization: `APIKEY ${apikey.key}`}
      );
      expect(document).toEqual({
        _id: "__skip__",
        username: "test_user1",
        password: "test_password1",
        age: 30
      });
    });

    it("should hide password field of bucket-data for specific apikey", async () => {
      let index = `export default function(request){
        let aggregation = [];
        if(request.headers.authorization == 'APIKEY ${apikey.key}' ){
          aggregation.push( { $project: { password:0 } } )
        }
        return aggregation;
      }`;
      await req.post(`/function/${fn._id}/index`, {index}, {Authorization: token});

      let {body: document} = await req.get(
        `/bucket/${bucket._id}/data/${user1._id}`,
        {},
        {Authorization: `APIKEY ${apikey.key}`}
      );
      expect(document).toEqual({_id: "__skip__", username: "test_user1", age: 30});
    });
  });

  describe("INDEX", () => {
    beforeAll(async () => {
      fn = {
        name: "test",
        description: "test",
        triggers: {
          default: {
            options: {
              bucket: bucket._id,
              type: "INDEX"
            },
            type: "bucket",
            active: true
          }
        },
        env: {}
      };
      fn = await req.post("/function", fn, {Authorization: token}).then(res => res.body);
    });

    afterAll(async () => {
      await req.delete(`/function/${fn._id}`, {}, {Authorization: token});
    });

    it("should not change the behaviour of bucket-data endpoint", async () => {
      let index = `export default function(request){
        return [];
      }`;
      await req.post(`/function/${fn._id}/index`, {index}, {Authorization: token});

      let {body: document} = await req.get(
        `/bucket/${bucket._id}/data`,
        {},
        {Authorization: `APIKEY ${apikey.key}`}
      );
      expect(document).toEqual([
        {_id: "__skip__", username: "test_user1", password: "test_password1", age: 30},
        {_id: "__skip__", username: "test_user2", password: "test_password2", age: 19}
      ]);
    });

    it("should filter users", async () => {
      let index = `export default function(request){
        return [ { $match: { age: { $lt: 20 } } } ]
      }`;
      await req.post(`/function/${fn._id}/index`, {index}, {Authorization: token});

      let {body: document} = await req.get(
        `/bucket/${bucket._id}/data`,
        {},
        {Authorization: `APIKEY ${apikey.key}`}
      );
      expect(document).toEqual([
        {_id: "__skip__", username: "test_user2", password: "test_password2", age: 19}
      ]);
    });
  });

  describe("UPDATE", () => {
    beforeAll(async () => {
      fn = {
        name: "test",
        description: "test",
        triggers: {
          default: {
            options: {
              bucket: bucket._id,
              type: "UPDATE"
            },
            type: "bucket",
            active: true
          }
        },
        env: {}
      };
      fn = await req.post("/function", fn, {Authorization: token}).then(res => res.body);
    });

    afterAll(async () => {
      await req.delete(`/function/${fn._id}`, {}, {Authorization: token});
    });

    it("should not allow to update to the user1 data", async () => {
      let index = `export default function(request){
        if( request.document == '${user1._id}' ) return false;
        else return true;
      }`;
      await req.post(`/function/${fn._id}/index`, {index}, {Authorization: token});

      let response = await req.put(
        `/bucket/${bucket._id}/data/${user1._id}`,
        {username: "new_username", password: "new_password", age: 10},
        {Authorization: `APIKEY ${apikey.key}`}
      );
      expect([response.statusCode, response.statusText]).toEqual([403, "Forbidden"]);
    });

    it("should allow to update to the user2 data", async () => {
      let index = `export default function(request){
        if( request.document == '${user1._id}' ) return false;
        else return true;
      }`;
      await req.post(`/function/${fn._id}/index`, {index}, {Authorization: token});

      let {body: user} = await req.put(
        `/bucket/${bucket._id}/data/${user2._id}`,
        {username: "new_username", password: "new_password", age: 10},
        {Authorization: `APIKEY ${apikey.key}`}
      );
      expect(user).toEqual({
        _id: "__skip__",
        username: "new_username",
        password: "new_password",
        age: 10
      });
    });
  });

  describe("INSERT", () => {
    beforeAll(async () => {
      fn = {
        name: "test",
        description: "test",
        triggers: {
          default: {
            options: {
              bucket: bucket._id,
              type: "INSERT"
            },
            type: "bucket",
            active: true
          }
        },
        env: {}
      };
      fn = await req.post("/function", fn, {Authorization: token}).then(res => res.body);
    });

    afterAll(async () => {
      await req.delete(`/function/${fn._id}`, {}, {Authorization: token});
    });

    it("should not allow to insert action for specific apikey", async () => {
      let index = `export default function(request){
        if(request.headers.authorization == 'APIKEY ${apikey.key}' ){
          return false;
        }else{
          return true;
        }
      }`;
      await req.post(`/function/${fn._id}/index`, {index}, {Authorization: token});

      let response = await req.post(
        `/bucket/${bucket._id}/data`,
        {username: "user3", password: "password3", age: 36},
        {Authorization: `APIKEY ${apikey.key}`}
      );
      expect([response.statusCode, response.statusText]).toEqual([403, "Forbidden"]);
    });

    it("should allow to insert action", async () => {
      let index = `export default function(request){
        return true;
      }`;
      await req.post(`/function/${fn._id}/index`, {index}, {Authorization: token});

      let {body: user3} = await req.post(
        `/bucket/${bucket._id}/data`,
        {username: "user3", password: "password3", age: 36},
        {Authorization: `APIKEY ${apikey.key}`}
      );
      expect(user3).toEqual({_id: "__skip__", username: "user3", password: "password3", age: 36});

      await req.delete(`/bucket/${bucket._id}/data/${user3._id}`, {}, {Authorization: token});
    });
  });
});
