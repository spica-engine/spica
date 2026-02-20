import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket";
import {SchemaModule} from "@spica-server/core/schema";
import {CREATED_AT, UPDATED_AT} from "@spica-server/core/schema/defaults";
import {DATE_TIME, OBJECTID_STRING, OBJECT_ID} from "@spica-server/core/schema/formats";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule, stream} from "@spica-server/database/testing";
import {PassportModule} from "@spica-server/passport";
import {PreferenceTestingModule} from "@spica-server/preference/testing";

const EXPIRES_IN = 60_000;

function getBucketName(id: string) {
  return `Bucket_${id}`;
}

describe("GraphQL ACL Rules with Different Authentication Strategies", () => {
  let app: INestApplication;
  let req: Request;
  let module: TestingModule;
  let identityToken: string;
  let apiKey: string;
  let userToken: string;
  let aclRejectedUserToken: string;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        SchemaModule.forRoot({
          formats: [OBJECT_ID, DATE_TIME, OBJECTID_STRING],
          defaults: [CREATED_AT, UPDATED_AT]
        }),
        CoreTestingModule,
        DatabaseTestingModule.replicaSet(),
        PassportModule.forRoot({
          publicUrl: "http://localhost",
          defaultStrategy: "IDENTITY",
          samlCertificateTTL: EXPIRES_IN,
          apikeyRealtime: false,
          refreshTokenRealtime: false,
          policyRealtime: false,
          identityOptions: {
            expiresIn: EXPIRES_IN,
            maxExpiresIn: EXPIRES_IN,
            issuer: "spica",
            secretOrKey: "spica",
            audience: "spica",
            defaultIdentityIdentifier: "spica",
            defaultIdentityPassword: "spica",
            defaultIdentityPolicies: [
              "ApiKeyFullAccess",
              "BucketFullAccess",
              "IdentityFullAccess",
              "PassportFullAccess",
              "PolicyFullAccess",
              "UserFullAccess"
            ],
            blockingOptions: {
              failedAttemptLimit: 3,
              blockDurationMinutes: 10
            },
            refreshTokenExpiresIn: 60 * 60 * 24 * 3,
            passwordHistoryLimit: 2,
            identityRealtime: false
          },
          userOptions: {
            expiresIn: EXPIRES_IN,
            maxExpiresIn: EXPIRES_IN,
            issuer: "spica",
            secretOrKey: "spica",
            audience: "spica",
            blockingOptions: {
              failedAttemptLimit: 3,
              blockDurationMinutes: 10
            },
            refreshTokenExpiresIn: 60 * 60 * 24 * 3,
            passwordHistoryLimit: 2,
            userRealtime: false
          }
        }),
        PreferenceTestingModule,
        BucketModule.forRoot({
          hooks: false,
          history: false,
          realtime: false,
          cache: false,
          graphql: true
        })
      ]
    }).compile();

    app = module.createNestApplication();
    req = module.get(Request);
    req.reject = false;
    await app.listen(req.socket);

    await new Promise(resolve => setTimeout(resolve, 3000));

    const identityLoginResponse = await req.post("/passport/identify", {
      identifier: "spica",
      password: "spica"
    });
    identityToken = identityLoginResponse.body.token;

    const [apiKeyResponse, userResponse, aclRejectedUserResponse] = await Promise.all([
      req.post(
        "/passport/apikey",
        {
          name: "test-apikey",
          description: "Test API Key"
        },
        {Authorization: `IDENTITY ${identityToken}`}
      ),
      req.post(
        "/passport/user",
        {
          username: "oziko",
          password: "password123"
        },
        {Authorization: `IDENTITY ${identityToken}`}
      ),
      req.post(
        "/passport/user",
        {
          username: "aclRejectedUser",
          password: "password123"
        },
        {Authorization: `IDENTITY ${identityToken}`}
      )
    ]);

    const apiKeyId = apiKeyResponse.body._id;
    apiKey = apiKeyResponse.body.key;
    const userId = userResponse.body._id;
    const aclRejectedUserId = aclRejectedUserResponse.body._id;

    await Promise.all([
      req.put(`/passport/apikey/${apiKeyId}/policy/BucketFullAccess`, undefined, {
        Authorization: `IDENTITY ${identityToken}`
      }),
      req.put(`/passport/user/${userId}/policy/BucketFullAccess`, undefined, {
        Authorization: `IDENTITY ${identityToken}`
      }),
      req.put(`/passport/user/${aclRejectedUserId}/policy/BucketFullAccess`, undefined, {
        Authorization: `IDENTITY ${identityToken}`
      })
    ]);

    const [userLoginResponse, aclRejectedUserLoginResponse] = await Promise.all([
      req.post("/passport/login", {
        username: "oziko",
        password: "password123"
      }),
      req.post("/passport/login", {
        username: "aclRejectedUser",
        password: "password123"
      })
    ]);

    userToken = userLoginResponse.body.token;
    aclRejectedUserToken = aclRejectedUserLoginResponse.body.token;
  });

  afterEach(() => app.close());

  describe("Write ACL Rules", () => {
    describe("when ACL write rule is 'auth.username == document.owner'", () => {
      let bucketId: string;
      let bucketName: string;

      beforeEach(async () => {
        const bucket = {
          title: "GraphQL ACL Write Bucket",
          description: "Test bucket for GraphQL write ACL",
          icon: "view_stream",
          primary: "title",
          acl: {
            write: "auth.username == document.owner",
            read: "true==true"
          },
          properties: {
            title: {
              type: "string",
              title: "Title"
            },
            description: {
              type: "string",
              title: "Description"
            },
            owner: {
              type: "string",
              title: "Owner"
            }
          }
        };

        const response = await req.post("/bucket", bucket, {
          Authorization: `IDENTITY ${identityToken}`
        });
        bucketId = response.body._id;
        bucketName = getBucketName(bucketId);

        await stream.change.next();
      });

      it("should allow insert via graphql with correct USER token", async () => {
        const body = {
          query: `mutation {
            insert${bucketName}(input: { title: "Test Document", description: "Created by oziko", owner: "oziko" }){
              _id
              title
              description
              owner
            }
          }`
        };

        const response = await req.post("/graphql", body, {
          Authorization: `USER ${userToken}`
        });

        expect(response.statusCode).toBe(200);
        expect(response.body.data[`insert${bucketName}`].title).toBe("Test Document");
        expect(response.body.data[`insert${bucketName}`].owner).toBe("oziko");
      });

      it("should reject insert via graphql for aclRejectedUser", async () => {
        const body = {
          query: `mutation {
            insert${bucketName}(input: { title: "Test Document", description: "Rejected insert", owner: "oziko" }){
              _id
              title
            }
          }`
        };

        const response = await req.post("/graphql", body, {
          Authorization: `USER ${aclRejectedUserToken}`
        });

        expect(response.body.errors).toBeTruthy();
        expect(response.body.errors[0].message).toBe("ACL rules has rejected this operation.");
      });

      it("should bypass ACL and allow insert via graphql with IDENTITY token", async () => {
        const body = {
          query: `mutation {
            insert${bucketName}(input: { title: "Test Document", description: "Created by identity", owner: "someuser" }){
              _id
              title
              description
            }
          }`
        };

        const response = await req.post("/graphql", body, {
          Authorization: `IDENTITY ${identityToken}`
        });

        expect(response.statusCode).toBe(200);
        expect(response.body.data[`insert${bucketName}`].title).toBe("Test Document");
      });

      it("should bypass ACL and allow insert via graphql with APIKEY", async () => {
        const body = {
          query: `mutation {
            insert${bucketName}(input: { title: "Test Document", description: "Created by apikey", owner: "someuser" }){
              _id
              title
              description
            }
          }`
        };

        const response = await req.post("/graphql", body, {
          Authorization: `APIKEY ${apiKey}`
        });

        expect(response.statusCode).toBe(200);
        expect(response.body.data[`insert${bucketName}`].title).toBe("Test Document");
      });

      it("should allow replace via graphql with correct USER token", async () => {
        const insertResponse = await req.post(
          `/bucket/${bucketId}/data`,
          {title: "Original", description: "Original", owner: "oziko"},
          {Authorization: `IDENTITY ${identityToken}`}
        );
        const documentId = insertResponse.body._id;

        const body = {
          query: `mutation {
            replace${bucketName}(_id: "${documentId}", input: { title: "Updated", description: "Updated by oziko", owner: "oziko" }){
              _id
              title
              description
            }
          }`
        };

        const response = await req.post("/graphql", body, {
          Authorization: `USER ${userToken}`
        });

        expect(response.statusCode).toBe(200);
        expect(response.body.data[`replace${bucketName}`].title).toBe("Updated");
      });

      it("should reject replace via graphql for aclRejectedUser", async () => {
        const insertResponse = await req.post(
          `/bucket/${bucketId}/data`,
          {title: "Original", description: "Original", owner: "oziko"},
          {Authorization: `IDENTITY ${identityToken}`}
        );
        const documentId = insertResponse.body._id;

        const body = {
          query: `mutation {
            replace${bucketName}(_id: "${documentId}", input: { title: "Updated", description: "Updated by rejected user", owner: "oziko" }){
              _id
              title
            }
          }`
        };

        const response = await req.post("/graphql", body, {
          Authorization: `USER ${aclRejectedUserToken}`
        });

        expect(response.body.errors).toBeTruthy();
        expect(response.body.errors[0].message).toBe("ACL rules has rejected this operation.");
      });

      it("should allow delete via graphql with correct USER token", async () => {
        const insertResponse = await req.post(
          `/bucket/${bucketId}/data`,
          {title: "To be deleted", description: "Will be deleted", owner: "oziko"},
          {Authorization: `IDENTITY ${identityToken}`}
        );
        const documentId = insertResponse.body._id;

        const body = {
          query: `mutation {
            delete${bucketName}(_id: "${documentId}")
          }`
        };

        const response = await req.post("/graphql", body, {
          Authorization: `USER ${userToken}`
        });

        expect(response.statusCode).toBe(200);
      });

      it("should reject delete via graphql for aclRejectedUser", async () => {
        const insertResponse = await req.post(
          `/bucket/${bucketId}/data`,
          {title: "To be deleted", description: "Will not be deleted", owner: "oziko"},
          {Authorization: `IDENTITY ${identityToken}`}
        );
        const documentId = insertResponse.body._id;

        const body = {
          query: `mutation {
            delete${bucketName}(_id: "${documentId}")
          }`
        };

        const response = await req.post("/graphql", body, {
          Authorization: `USER ${aclRejectedUserToken}`
        });

        expect(response.body.errors).toBeTruthy();
        expect(response.body.errors[0].message).toBe("ACL rules has rejected this operation.");
      });
    });
  });

  describe("Read ACL Rules", () => {
    describe("when ACL read rule is 'auth.username == document.owner'", () => {
      let bucketId: string;
      let bucketName: string;
      let documentId: string;

      beforeEach(async () => {
        const bucket = {
          title: "GraphQL ACL Read Bucket",
          description: "Test bucket for GraphQL read ACL",
          icon: "view_stream",
          primary: "title",
          acl: {
            write: "true == true",
            read: "auth.username == document.owner"
          },
          properties: {
            title: {
              type: "string",
              title: "Title"
            },
            description: {
              type: "string",
              title: "Description"
            },
            owner: {
              type: "string",
              title: "Owner"
            }
          }
        };

        const response = await req.post("/bucket", bucket, {
          Authorization: `IDENTITY ${identityToken}`
        });
        bucketId = response.body._id;
        bucketName = getBucketName(bucketId);

        await stream.change.next();

        const docResponse = await req.post(
          `/bucket/${bucketId}/data`,
          {title: "Test Document", description: "Test description", owner: "oziko"},
          {Authorization: `IDENTITY ${identityToken}`}
        );
        documentId = docResponse.body._id;
      });

      it("should return documents matching ACL read rule for USER token", async () => {
        const params = {
          query: `{
            Find${bucketName}{
              meta{ total }
              data{ _id title owner }
            }
          }`
        };

        const response = await req.get("/graphql", params, {
          Authorization: `USER ${userToken}`
        });

        expect(response.statusCode).toBe(200);
        expect(response.body.data[`Find${bucketName}`].data.length).toBe(1);
        expect(response.body.data[`Find${bucketName}`].data[0]._id).toBe(documentId);
        expect(response.body.data[`Find${bucketName}`].data[0].title).toBe("Test Document");
      });

      it("should return no documents for aclRejectedUser", async () => {
        const params = {
          query: `{
            Find${bucketName}{
              meta{ total }
              data{ _id title owner }
            }
          }`
        };

        const response = await req.get("/graphql", params, {
          Authorization: `USER ${aclRejectedUserToken}`
        });

        expect(response.statusCode).toBe(200);
        expect(response.body.data[`Find${bucketName}`].data).toEqual([]);
      });

      it("should bypass ACL and return all documents with IDENTITY token", async () => {
        const params = {
          query: `{
            Find${bucketName}{
              meta{ total }
              data{ _id title owner }
            }
          }`
        };

        const response = await req.get("/graphql", params, {
          Authorization: `IDENTITY ${identityToken}`
        });

        expect(response.statusCode).toBe(200);
        expect(response.body.data[`Find${bucketName}`].data.length).toBe(1);
        expect(response.body.data[`Find${bucketName}`].data[0]._id).toBe(documentId);
      });

      it("should bypass ACL and return all documents with APIKEY", async () => {
        const params = {
          query: `{
            Find${bucketName}{
              meta{ total }
              data{ _id title owner }
            }
          }`
        };

        const response = await req.get("/graphql", params, {
          Authorization: `APIKEY ${apiKey}`
        });

        expect(response.statusCode).toBe(200);
        expect(response.body.data[`Find${bucketName}`].data.length).toBe(1);
        expect(response.body.data[`Find${bucketName}`].data[0]._id).toBe(documentId);
      });

      it("should return document by ID matching ACL read rule for USER token", async () => {
        const params = {
          query: `{
            FindBy${bucketName}Id(_id: "${documentId}"){
              _id
              title
              owner
            }
          }`
        };

        const response = await req.get("/graphql", params, {
          Authorization: `USER ${userToken}`
        });

        expect(response.statusCode).toBe(200);
        expect(response.body.data[`FindBy${bucketName}Id`]._id).toBe(documentId);
        expect(response.body.data[`FindBy${bucketName}Id`].title).toBe("Test Document");
      });

      it("should return null for findById for aclRejectedUser", async () => {
        const params = {
          query: `{
            FindBy${bucketName}Id(_id: "${documentId}"){
              _id
              title
              owner
            }
          }`
        };

        const response = await req.get("/graphql", params, {
          Authorization: `USER ${aclRejectedUserToken}`
        });

        expect(response.statusCode).toBe(200);
        expect(response.body.data[`FindBy${bucketName}Id`]).toBeNull();
      });
    });
  });

  describe("Field-level ACL Rules", () => {
    describe("when property has acl ", () => {
      let bucketId: string;
      let bucketName: string;
      let documentId: string;

      beforeEach(async () => {
        const bucket = {
          title: "GraphQL Field ACL Bucket",
          description: "Test bucket for GraphQL field-level ACL",
          icon: "view_stream",
          primary: "title",
          acl: {
            write: "true==true",
            read: "true==true"
          },
          properties: {
            title: {
              type: "string",
              title: "Title"
            },
            secret_info: {
              type: "string",
              title: "Secret Info",
              options: {
                position: "bottom"
              },
              acl: "auth.username=='oziko'"
            }
          }
        };

        const response = await req.post("/bucket", bucket, {
          Authorization: `IDENTITY ${identityToken}`
        });
        bucketId = response.body._id;
        bucketName = getBucketName(bucketId);

        await stream.change.next();

        const docResponse = await req.post(
          `/bucket/${bucketId}/data`,
          {title: "Test Document", secret_info: "Hidden Data"},
          {Authorization: `IDENTITY ${identityToken}`}
        );
        documentId = docResponse.body._id;
      });

      it("should include field when field-level ACL allows access for USER token", async () => {
        const params = {
          query: `{
            Find${bucketName}{
              meta{ total }
              data{ _id title secret_info }
            }
          }`
        };

        const response = await req.get("/graphql", params, {
          Authorization: `USER ${userToken}`
        });

        expect(response.statusCode).toBe(200);
        expect(response.body.data[`Find${bucketName}`].data.length).toBe(1);
        expect(response.body.data[`Find${bucketName}`].data[0].title).toBe("Test Document");
        expect(response.body.data[`Find${bucketName}`].data[0].secret_info).toBe("Hidden Data");
      });

      it("should exclude field when field-level ACL rejects access for USER token", async () => {
        const params = {
          query: `{
            Find${bucketName}{
              meta{ total }
              data{ _id title secret_info }
            }
          }`
        };

        const response = await req.get("/graphql", params, {
          Authorization: `USER ${aclRejectedUserToken}`
        });

        expect(response.statusCode).toBe(200);
        expect(response.body.data[`Find${bucketName}`].data.length).toBe(1);
        expect(response.body.data[`Find${bucketName}`].data[0].title).toBe("Test Document");
        expect(response.body.data[`Find${bucketName}`].data[0].secret_info).toBeNull();
      });
    });
  });
});
