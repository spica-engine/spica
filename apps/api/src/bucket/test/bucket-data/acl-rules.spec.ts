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
  let wrongUserToken: string;

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

    const apiKeyResponse = await req.post(
      "/passport/apikey",
      {
        name: "test-apikey",
        description: "Test API Key"
      },
      {Authorization: `IDENTITY ${identityToken}`}
    );
    const apiKeyId = apiKeyResponse.body._id;
    apiKey = apiKeyResponse.body.key;

    await req.put(`/passport/apikey/${apiKeyId}/policy/BucketFullAccess`, undefined, {
      Authorization: `IDENTITY ${identityToken}`
    });

    const userResponse = await req.post(
      "/passport/user",
      {
        username: "oziko",
        password: "password123"
      },
      {Authorization: `IDENTITY ${identityToken}`}
    );
    const userId = userResponse.body._id;

    await req.put(`/passport/user/${userId}/policy/BucketFullAccess`, undefined, {
      Authorization: `IDENTITY ${identityToken}`
    });

    const userLoginResponse = await req.post("/passport/login", {
      username: "oziko",
      password: "password123"
    });
    userToken = userLoginResponse.body.token;

    const wrongUserResponse = await req.post(
      "/passport/user",
      {
        username: "wronguser",
        password: "password123"
      },
      {Authorization: `IDENTITY ${identityToken}`}
    );
    const wrongUserId = wrongUserResponse.body._id;

    await req.put(`/passport/user/${wrongUserId}/policy/BucketFullAccess`, undefined, {
      Authorization: `IDENTITY ${identityToken}`
    });

    const wrongUserLoginResponse = await req.post("/passport/login", {
      username: "wronguser",
      password: "password123"
    });
    wrongUserToken = wrongUserLoginResponse.body.token;
  });

  afterEach(() => app.close());

  describe("Write ACL Rules", () => {
    describe("when ACL write rule is 'auth.username == \"oziko\"'", () => {
      let bucketId: string;

      beforeEach(async () => {
        const bucket = {
          title: "Test Bucket",
          description: "Test bucket for ACL",
          icon: "view_stream",
          primary: "title",
          acl: {
            write: 'auth.username=="oziko"',
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
            description: "Created by oziko"
          },
          {Authorization: `USER ${userToken}`}
        );

        expect(response.statusCode).toBe(201);
        expect(response.body.title).toBe("Test Document");
        expect(response.body.description).toBe("Created by oziko");
      });

      it("should reject insert with incorrect USER token", async () => {
        const response = await req.post(
          `/bucket/${bucketId}/data`,
          {
            title: "Test Document",
            description: "Created by wrong user"
          },
          {Authorization: `USER ${wrongUserToken}`}
        );

        expect(response.statusCode).toBe(401);
        expect(response.body.message).toBe("ACL rules has rejected this operation.");
      });

      it("should bypass ACL and allow insert with IDENTITY token", async () => {
        const response = await req.post(
          `/bucket/${bucketId}/data`,
          {
            title: "Test Document",
            description: "Created by identity"
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
            description: "Created by apikey"
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
            description: "Original description"
          },
          {Authorization: `IDENTITY ${identityToken}`}
        );
        const documentId = createResponse.body._id;

        const updateResponse = await req.put(
          `/bucket/${bucketId}/data/${documentId}`,
          {
            title: "Updated",
            description: "Updated by oziko"
          },
          {Authorization: `USER ${userToken}`}
        );

        expect(updateResponse.statusCode).toBe(200);
        expect(updateResponse.body.title).toBe("Updated");
      });

      it("should reject update with incorrect USER token", async () => {
        const createResponse = await req.post(
          `/bucket/${bucketId}/data`,
          {
            title: "Original",
            description: "Original description"
          },
          {Authorization: `IDENTITY ${identityToken}`}
        );
        const documentId = createResponse.body._id;

        const updateResponse = await req.put(
          `/bucket/${bucketId}/data/${documentId}`,
          {
            title: "Updated",
            description: "Updated by wrong user"
          },
          {Authorization: `USER ${wrongUserToken}`}
        );

        expect(updateResponse.statusCode).toBe(401);
        expect(updateResponse.body.message).toBe("ACL rules has rejected this operation.");
      });

      it("should bypass ACL and allow update with IDENTITY token", async () => {
        const createResponse = await req.post(
          `/bucket/${bucketId}/data`,
          {
            title: "Original",
            description: "Original description"
          },
          {Authorization: `IDENTITY ${identityToken}`}
        );
        const documentId = createResponse.body._id;

        const updateResponse = await req.put(
          `/bucket/${bucketId}/data/${documentId}`,
          {
            title: "Updated by Identity",
            description: "Updated description"
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
            description: "Original description"
          },
          {Authorization: `IDENTITY ${identityToken}`}
        );
        const documentId = createResponse.body._id;

        const updateResponse = await req.put(
          `/bucket/${bucketId}/data/${documentId}`,
          {
            title: "Updated by APIKEY",
            description: "Updated description"
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
            description: "Will be deleted"
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

      it("should reject delete with incorrect USER token", async () => {
        const createResponse = await req.post(
          `/bucket/${bucketId}/data`,
          {
            title: "To be deleted",
            description: "Will not be deleted"
          },
          {Authorization: `IDENTITY ${identityToken}`}
        );
        const documentId = createResponse.body._id;

        const deleteResponse = await req.delete(
          `/bucket/${bucketId}/data/${documentId}`,
          undefined,
          {Authorization: `USER ${wrongUserToken}`}
        );

        expect(deleteResponse.statusCode).toBe(401);
        expect(deleteResponse.body.message).toBe("ACL rules has rejected this operation.");
      });

      it("should bypass ACL and allow delete with IDENTITY token", async () => {
        const createResponse = await req.post(
          `/bucket/${bucketId}/data`,
          {
            title: "To be deleted",
            description: "Will be deleted by identity"
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
            description: "Will be deleted by apikey"
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
    describe("when ACL read rule is 'auth.username == \"oziko\"'", () => {
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
            read: 'auth.username == "oziko"'
          },
          properties: {
            title: {
              type: "string",
              title: "Title"
            },
            description: {
              type: "string",
              title: "Description"
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
            description: "Test description"
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

      it("should reject read with incorrect USER token", async () => {
        const response = await req.get(
          `/bucket/${bucketId}/data`,
          {},
          {Authorization: `USER ${wrongUserToken}`}
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

      it("should reject read single document with incorrect USER token", async () => {
        const response = await req.get(
          `/bucket/${bucketId}/data/${documentId}`,
          {},
          {Authorization: `USER ${wrongUserToken}`}
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
