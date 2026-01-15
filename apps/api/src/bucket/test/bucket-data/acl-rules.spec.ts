import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket";
import {SchemaModule} from "@spica-server/core/schema";
import {CREATED_AT, UPDATED_AT} from "@spica-server/core/schema/defaults";
import {DATE_TIME, OBJECTID_STRING, OBJECT_ID} from "@spica-server/core/schema/formats";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {PassportModule} from "@spica-server/passport";
import {PreferenceTestingModule} from "@spica-server/preference/testing";

const EXPIRES_IN = 60_000;

describe("ACL Rules with Different Authentication Strategies", () => {
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
            defaultUserUsername: "defaultuser",
            defaultUserPassword: "defaultpassword",
            defaultUserPolicies: [],
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
          graphql: false
        })
      ]
    }).compile();
    app = module.createNestApplication();
    req = module.get(Request);
    req.reject = false;
    await app.listen(req.socket);

    // Wait for default identity to be created
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

      beforeEach(async () => {
        const bucket = {
          title: "Test Bucket",
          description: "Test bucket for ACL",
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
      });

      it("should allow insert with correct USER token", async () => {
        const response = await req.post(
          `/bucket/${bucketId}/data`,
          {
            title: "Test Document",
            description: "Created by oziko",
            owner: "oziko"
          },
          {Authorization: `USER ${userToken}`}
        );

        expect(response.statusCode).toBe(201);
        expect(response.body.title).toBe("Test Document");
        expect(response.body.description).toBe("Created by oziko");
        expect(response.body.owner).toBe("oziko");
      });

      it("should reject insert for aclRejectedUser", async () => {
        const response = await req.post(
          `/bucket/${bucketId}/data`,
          {
            title: "Test Document",
            description: "Created by ACL rejected user",
            owner: "oziko"
          },
          {Authorization: `USER ${aclRejectedUserToken}`}
        );

        expect(response.statusCode).toBe(401);
        expect(response.body.message).toBe("ACL rules has rejected this operation.");
      });

      it("should bypass ACL and allow insert with IDENTITY token", async () => {
        const response = await req.post(
          `/bucket/${bucketId}/data`,
          {
            title: "Test Document",
            description: "Created by identity",
            owner: "someuser"
          },
          {Authorization: `IDENTITY ${identityToken}`}
        );

        expect(response.statusCode).toBe(201);
        expect(response.body.title).toBe("Test Document");
        expect(response.body.description).toBe("Created by identity");
      });

      it("should bypass ACL and allow insert with APIKEY", async () => {
        const response = await req.post(
          `/bucket/${bucketId}/data`,
          {
            title: "Test Document",
            description: "Created by apikey",
            owner: "someuser"
          },
          {Authorization: `APIKEY ${apiKey}`}
        );

        expect(response.statusCode).toBe(201);
        expect(response.body.title).toBe("Test Document");
        expect(response.body.description).toBe("Created by apikey");
      });

      it("should allow update with correct USER token", async () => {
        const createResponse = await req.post(
          `/bucket/${bucketId}/data`,
          {
            title: "Original",
            description: "Original description",
            owner: "oziko"
          },
          {Authorization: `IDENTITY ${identityToken}`}
        );
        const documentId = createResponse.body._id;

        const updateResponse = await req.put(
          `/bucket/${bucketId}/data/${documentId}`,
          {
            title: "Updated",
            description: "Updated by oziko",
            owner: "oziko"
          },
          {Authorization: `USER ${userToken}`}
        );

        expect(updateResponse.statusCode).toBe(200);
        expect(updateResponse.body.title).toBe("Updated");
      });

      it("should reject update for aclRejectedUser", async () => {
        const createResponse = await req.post(
          `/bucket/${bucketId}/data`,
          {
            title: "Original",
            description: "Original description",
            owner: "oziko"
          },
          {Authorization: `IDENTITY ${identityToken}`}
        );
        const documentId = createResponse.body._id;

        const updateResponse = await req.put(
          `/bucket/${bucketId}/data/${documentId}`,
          {
            title: "Updated",
            description: "Updated by ACL rejected user",
            owner: "oziko"
          },
          {Authorization: `USER ${aclRejectedUserToken}`}
        );

        expect(updateResponse.statusCode).toBe(401);
        expect(updateResponse.body.message).toBe("ACL rules has rejected this operation.");
      });

      it("should bypass ACL and allow update with IDENTITY token", async () => {
        const createResponse = await req.post(
          `/bucket/${bucketId}/data`,
          {
            title: "Original",
            description: "Original description",
            owner: "someuser"
          },
          {Authorization: `IDENTITY ${identityToken}`}
        );
        const documentId = createResponse.body._id;

        const updateResponse = await req.put(
          `/bucket/${bucketId}/data/${documentId}`,
          {
            title: "Updated by Identity",
            description: "Updated description",
            owner: "someuser"
          },
          {Authorization: `IDENTITY ${identityToken}`}
        );

        expect(updateResponse.statusCode).toBe(200);
        expect(updateResponse.body.title).toBe("Updated by Identity");
      });

      it("should bypass ACL and allow update with APIKEY", async () => {
        const createResponse = await req.post(
          `/bucket/${bucketId}/data`,
          {
            title: "Original",
            description: "Original description",
            owner: "someuser"
          },
          {Authorization: `IDENTITY ${identityToken}`}
        );
        const documentId = createResponse.body._id;

        const updateResponse = await req.put(
          `/bucket/${bucketId}/data/${documentId}`,
          {
            title: "Updated by APIKEY",
            description: "Updated description",
            owner: "someuser"
          },
          {Authorization: `APIKEY ${apiKey}`}
        );

        expect(updateResponse.statusCode).toBe(200);
        expect(updateResponse.body.title).toBe("Updated by APIKEY");
      });

      it("should allow delete with correct USER token", async () => {
        const createResponse = await req.post(
          `/bucket/${bucketId}/data`,
          {
            title: "To be deleted",
            description: "Will be deleted",
            owner: "oziko"
          },
          {Authorization: `IDENTITY ${identityToken}`}
        );
        const documentId = createResponse.body._id;

        const deleteResponse = await req.delete(
          `/bucket/${bucketId}/data/${documentId}`,
          undefined,
          {Authorization: `USER ${userToken}`}
        );

        expect(deleteResponse.statusCode).toBe(204);
      });

      it("should reject delete for aclRejectedUser", async () => {
        const createResponse = await req.post(
          `/bucket/${bucketId}/data`,
          {
            title: "To be deleted",
            description: "Will not be deleted",
            owner: "oziko"
          },
          {Authorization: `IDENTITY ${identityToken}`}
        );
        const documentId = createResponse.body._id;

        const deleteResponse = await req.delete(
          `/bucket/${bucketId}/data/${documentId}`,
          undefined,
          {Authorization: `USER ${aclRejectedUserToken}`}
        );

        expect(deleteResponse.statusCode).toBe(401);
        expect(deleteResponse.body.message).toBe("ACL rules has rejected this operation.");
      });

      it("should bypass ACL and allow delete with IDENTITY token", async () => {
        const createResponse = await req.post(
          `/bucket/${bucketId}/data`,
          {
            title: "To be deleted",
            description: "Will be deleted by identity",
            owner: "someuser"
          },
          {Authorization: `IDENTITY ${identityToken}`}
        );
        const documentId = createResponse.body._id;

        const deleteResponse = await req.delete(
          `/bucket/${bucketId}/data/${documentId}`,
          undefined,
          {Authorization: `IDENTITY ${identityToken}`}
        );

        expect(deleteResponse.statusCode).toBe(204);
      });

      it("should bypass ACL and allow delete with APIKEY", async () => {
        const createResponse = await req.post(
          `/bucket/${bucketId}/data`,
          {
            title: "To be deleted",
            description: "Will be deleted by apikey",
            owner: "someuser"
          },
          {Authorization: `IDENTITY ${identityToken}`}
        );
        const documentId = createResponse.body._id;

        const deleteResponse = await req.delete(
          `/bucket/${bucketId}/data/${documentId}`,
          undefined,
          {Authorization: `APIKEY ${apiKey}`}
        );

        expect(deleteResponse.statusCode).toBe(204);
      });
    });
  });

  describe("Read ACL Rules", () => {
    describe("when ACL read rule is 'auth.username == document.owner'", () => {
      let bucketId: string;
      let documentId: string;

      beforeEach(async () => {
        const bucket = {
          title: "Test Bucket Read",
          description: "Test bucket for ACL read",
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

        const docResponse = await req.post(
          `/bucket/${bucketId}/data`,
          {
            title: "Test Document",
            description: "Test description",
            owner: "oziko"
          },
          {Authorization: `IDENTITY ${identityToken}`}
        );
        documentId = docResponse.body._id;
      });

      it("should allow read with correct USER token", async () => {
        const response = await req.get(
          `/bucket/${bucketId}/data`,
          {},
          {Authorization: `USER ${userToken}`}
        );

        expect(response.statusCode).toBe(200);
        expect(response.body.length).toBe(1);
        expect(response.body[0]._id).toBe(documentId);
        expect(response.body[0].title).toBe("Test Document");
      });

      it("should reject read for aclRejectedUser", async () => {
        const response = await req.get(
          `/bucket/${bucketId}/data`,
          {},
          {Authorization: `USER ${aclRejectedUserToken}`}
        );
        expect(response.body).toEqual([]);
      });

      it("should bypass ACL and allow read with IDENTITY token", async () => {
        const response = await req.get(
          `/bucket/${bucketId}/data`,
          {},
          {Authorization: `IDENTITY ${identityToken}`}
        );

        expect(response.statusCode).toBe(200);
        expect(response.body.length).toBe(1);
        expect(response.body[0]._id).toBe(documentId);
        expect(response.body[0].title).toBe("Test Document");
      });

      it("should bypass ACL and allow read with APIKEY", async () => {
        const response = await req.get(
          `/bucket/${bucketId}/data`,
          {},
          {Authorization: `APIKEY ${apiKey}`}
        );

        expect(response.statusCode).toBe(200);
        expect(response.body.length).toBe(1);
        expect(response.body[0]._id).toBe(documentId);
        expect(response.body[0].title).toBe("Test Document");
      });

      it("should allow read single document with correct USER token", async () => {
        const response = await req.get(
          `/bucket/${bucketId}/data/${documentId}`,
          {},
          {Authorization: `USER ${userToken}`}
        );

        expect(response.statusCode).toBe(200);
        expect(response.body._id).toBe(documentId);
        expect(response.body.title).toBe("Test Document");
      });

      it("should reject read single document for aclRejectedUser", async () => {
        const response = await req.get(
          `/bucket/${bucketId}/data/${documentId}`,
          {},
          {Authorization: `USER ${aclRejectedUserToken}`}
        );
        expect(response.body).toBe(undefined);
      });

      it("should bypass ACL and allow read single document with IDENTITY token", async () => {
        const response = await req.get(
          `/bucket/${bucketId}/data/${documentId}`,
          {},
          {Authorization: `IDENTITY ${identityToken}`}
        );

        expect(response.statusCode).toBe(200);
        expect(response.body._id).toBe(documentId);
        expect(response.body.title).toBe("Test Document");
      });

      it("should bypass ACL and allow read single document with APIKEY", async () => {
        const response = await req.get(
          `/bucket/${bucketId}/data/${documentId}`,
          {},
          {Authorization: `APIKEY ${apiKey}`}
        );

        expect(response.statusCode).toBe(200);
        expect(response.body._id).toBe(documentId);
        expect(response.body.title).toBe("Test Document");
      });
    });
  });
});
