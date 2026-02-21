import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket";
import {SchemaModule} from "@spica-server/core/schema";
import {CREATED_AT, UPDATED_AT} from "@spica-server/core/schema/defaults";
import {DATE_TIME, OBJECTID_STRING, OBJECT_ID} from "@spica-server/core/schema/formats";
import {CoreTestingModule, Request, Websocket} from "@spica-server/core/testing";
import {WsAdapter} from "@spica-server/core/websocket";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {ChunkKind} from "@spica-server/interface/realtime";
import {PassportModule} from "@spica-server/passport";
import {PreferenceTestingModule} from "@spica-server/preference/testing";

const EXPIRES_IN = 60_000;

describe("Realtime ACL Rules with Different Authentication Strategies", () => {
  let app: INestApplication;
  let req: Request;
  let wsc: Websocket;
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
          realtime: true,
          cache: false,
          graphql: false
        })
      ]
    }).compile();

    wsc = module.get(Websocket);
    req = module.get(Request);
    req.reject = false;
    app = module.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.listen(wsc.socket);

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
          title: "Realtime ACL Write Bucket",
          description: "Test bucket for realtime write ACL",
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

      it("should allow insert via websocket with correct USER token", done => {
        const messageSpy = jest.fn();
        const ws = wsc.get(`/bucket/${bucketId}/data`, {
          headers: {Authorization: `USER ${userToken}`}
        });

        ws.onmessage = async e => {
          const message = JSON.parse(e.data as string);
          messageSpy(message);

          if (message.kind === ChunkKind.Response && message.status === 201) {
            expect(message.status).toBe(201);
            expect(message.message).toBe("Created");
            await ws.close();
            done();
          }
        };

        ws.connect.then(() =>
          ws.send(
            JSON.stringify({
              event: "insert",
              data: {title: "Test Document", description: "Created by oziko", owner: "oziko"}
            })
          )
        );
      });

      it("should reject insert via websocket for aclRejectedUser", done => {
        const ws = wsc.get(`/bucket/${bucketId}/data`, {
          headers: {Authorization: `USER ${aclRejectedUserToken}`}
        });

        ws.onmessage = async e => {
          const message = JSON.parse(e.data as string);

          if (message.kind === ChunkKind.Response) {
            expect(message.status).toBe(401);
            expect(message.message).toBe("ACL rules has rejected this operation.");
            await ws.close();
            done();
          }
        };

        ws.connect.then(() =>
          ws.send(
            JSON.stringify({
              event: "insert",
              data: {title: "Test Document", description: "Rejected insert", owner: "oziko"}
            })
          )
        );
      });

      it("should bypass ACL and allow insert via websocket with IDENTITY token", done => {
        const ws = wsc.get(`/bucket/${bucketId}/data`, {
          headers: {Authorization: `IDENTITY ${identityToken}`}
        });

        ws.onmessage = async e => {
          const message = JSON.parse(e.data as string);

          if (message.kind === ChunkKind.Response && message.status === 201) {
            expect(message.status).toBe(201);
            expect(message.message).toBe("Created");
            await ws.close();
            done();
          }
        };

        ws.connect.then(() =>
          ws.send(
            JSON.stringify({
              event: "insert",
              data: {title: "Test Document", description: "Created by identity", owner: "someuser"}
            })
          )
        );
      });

      it("should bypass ACL and allow insert via websocket with APIKEY", done => {
        const ws = wsc.get(`/bucket/${bucketId}/data`, {
          headers: {Authorization: `APIKEY ${apiKey}`}
        });

        ws.onmessage = async e => {
          const message = JSON.parse(e.data as string);

          if (message.kind === ChunkKind.Response && message.status === 201) {
            expect(message.status).toBe(201);
            expect(message.message).toBe("Created");
            await ws.close();
            done();
          }
        };

        ws.connect.then(() =>
          ws.send(
            JSON.stringify({
              event: "insert",
              data: {title: "Test Document", description: "Created by apikey", owner: "someuser"}
            })
          )
        );
      });

      it("should allow replace via websocket with correct USER token", done => {
        req
          .post(
            `/bucket/${bucketId}/data`,
            {title: "Original", description: "Original", owner: "oziko"},
            {Authorization: `IDENTITY ${identityToken}`}
          )
          .then(createResponse => {
            const documentId = createResponse.body._id;

            const ws = wsc.get(`/bucket/${bucketId}/data`, {
              headers: {Authorization: `USER ${userToken}`}
            });

            ws.onmessage = async e => {
              const message = JSON.parse(e.data as string);

              if (message.kind === ChunkKind.Response && message.status === 200) {
                expect(message.status).toBe(200);
                await ws.close();
                done();
              }
            };

            ws.connect.then(() =>
              ws.send(
                JSON.stringify({
                  event: "replace",
                  data: {
                    _id: documentId,
                    title: "Updated",
                    description: "Updated by oziko",
                    owner: "oziko"
                  }
                })
              )
            );
          });
      });

      it("should reject replace via websocket for aclRejectedUser", done => {
        req
          .post(
            `/bucket/${bucketId}/data`,
            {title: "Original", description: "Original", owner: "oziko"},
            {Authorization: `IDENTITY ${identityToken}`}
          )
          .then(createResponse => {
            const documentId = createResponse.body._id;

            const ws = wsc.get(`/bucket/${bucketId}/data`, {
              headers: {Authorization: `USER ${aclRejectedUserToken}`}
            });

            ws.onmessage = async e => {
              const message = JSON.parse(e.data as string);

              if (message.kind === ChunkKind.Response) {
                expect(message.status).toBe(401);
                expect(message.message).toBe("ACL rules has rejected this operation.");
                await ws.close();
                done();
              }
            };

            ws.connect.then(() =>
              ws.send(
                JSON.stringify({
                  event: "replace",
                  data: {
                    _id: documentId,
                    title: "Updated",
                    description: "Updated by rejected user",
                    owner: "oziko"
                  }
                })
              )
            );
          });
      });

      it("should allow delete via websocket with correct USER token", done => {
        req
          .post(
            `/bucket/${bucketId}/data`,
            {title: "To be deleted", description: "Will be deleted", owner: "oziko"},
            {Authorization: `IDENTITY ${identityToken}`}
          )
          .then(createResponse => {
            const documentId = createResponse.body._id;

            const ws = wsc.get(`/bucket/${bucketId}/data`, {
              headers: {Authorization: `USER ${userToken}`}
            });

            ws.onmessage = async e => {
              const message = JSON.parse(e.data as string);

              if (message.kind === ChunkKind.Response && message.status === 204) {
                expect(message.status).toBe(204);
                await ws.close();
                done();
              }
            };

            ws.connect.then(() =>
              ws.send(JSON.stringify({event: "delete", data: {_id: documentId}}))
            );
          });
      });

      it("should reject delete via websocket for aclRejectedUser", done => {
        req
          .post(
            `/bucket/${bucketId}/data`,
            {title: "To be deleted", description: "Will not be deleted", owner: "oziko"},
            {Authorization: `IDENTITY ${identityToken}`}
          )
          .then(createResponse => {
            const documentId = createResponse.body._id;

            const ws = wsc.get(`/bucket/${bucketId}/data`, {
              headers: {Authorization: `USER ${aclRejectedUserToken}`}
            });

            ws.onmessage = async e => {
              const message = JSON.parse(e.data as string);

              if (message.kind === ChunkKind.Response) {
                expect(message.status).toBe(500);
                expect(message.message).toBe("ACL rules has rejected this operation.");
                await ws.close();
                done();
              }
            };

            ws.connect.then(() =>
              ws.send(JSON.stringify({event: "delete", data: {_id: documentId}}))
            );
          });
      });
    });
  });

  describe("Read ACL Rules", () => {
    describe("when ACL read rule is 'auth.username == document.owner'", () => {
      let bucketId: string;

      beforeEach(async () => {
        const bucket = {
          title: "Realtime ACL Read Bucket",
          description: "Test bucket for realtime read ACL",
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

        await req.post(
          `/bucket/${bucketId}/data`,
          {title: "Oziko Document", owner: "oziko"},
          {Authorization: `IDENTITY ${identityToken}`}
        );

        await req.post(
          `/bucket/${bucketId}/data`,
          {title: "Other User Document", owner: "otherUser"},
          {Authorization: `IDENTITY ${identityToken}`}
        );
      });

      it("should only receive documents matching ACL read rule for USER token", done => {
        const messageSpy = jest.fn();
        const lastMessage = JSON.stringify({kind: ChunkKind.EndOfInitial});

        const ws = wsc.get(`/bucket/${bucketId}/data`, {
          headers: {Authorization: `USER ${userToken}`}
        });

        ws.onmessage = async e => {
          messageSpy(JSON.parse(e.data as string));

          if (e.data == lastMessage) {
            const messages = messageSpy.mock.calls.map(c => c[0]);
            const initialDocs = messages.filter(m => m.kind === ChunkKind.Initial);

            expect(initialDocs.length).toBe(1);
            expect(initialDocs[0].document.title).toBe("Oziko Document");
            expect(initialDocs[0].document.owner).toBe("oziko");

            await ws.close();
            done();
          }
        };

        ws.connect;
      });

      it("should receive no documents for aclRejectedUser", done => {
        const messageSpy = jest.fn();
        const lastMessage = JSON.stringify({kind: ChunkKind.EndOfInitial});

        const ws = wsc.get(`/bucket/${bucketId}/data`, {
          headers: {Authorization: `USER ${aclRejectedUserToken}`}
        });

        ws.onmessage = async e => {
          messageSpy(JSON.parse(e.data as string));

          if (e.data == lastMessage) {
            const messages = messageSpy.mock.calls.map(c => c[0]);
            const initialDocs = messages.filter(m => m.kind === ChunkKind.Initial);

            expect(initialDocs.length).toBe(0);

            await ws.close();
            done();
          }
        };

        ws.connect;
      });

      it("should bypass ACL and receive all documents with IDENTITY token", done => {
        const messageSpy = jest.fn();
        const lastMessage = JSON.stringify({kind: ChunkKind.EndOfInitial});

        const ws = wsc.get(`/bucket/${bucketId}/data`, {
          headers: {Authorization: `IDENTITY ${identityToken}`}
        });

        ws.onmessage = async e => {
          messageSpy(JSON.parse(e.data as string));

          if (e.data == lastMessage) {
            const messages = messageSpy.mock.calls.map(c => c[0]);
            const initialDocs = messages.filter(m => m.kind === ChunkKind.Initial);

            expect(initialDocs.length).toBe(2);

            await ws.close();
            done();
          }
        };

        ws.connect;
      });

      it("should bypass ACL and receive all documents with APIKEY", done => {
        const messageSpy = jest.fn();
        const lastMessage = JSON.stringify({kind: ChunkKind.EndOfInitial});

        const ws = wsc.get(`/bucket/${bucketId}/data`, {
          headers: {Authorization: `APIKEY ${apiKey}`}
        });

        ws.onmessage = async e => {
          messageSpy(JSON.parse(e.data as string));

          if (e.data == lastMessage) {
            const messages = messageSpy.mock.calls.map(c => c[0]);
            const initialDocs = messages.filter(m => m.kind === ChunkKind.Initial);

            expect(initialDocs.length).toBe(2);

            await ws.close();
            done();
          }
        };

        ws.connect;
      });
    });
  });

  describe("Field-level ACL Rules", () => {
    describe("when property has acl", () => {
      let bucketId: string;

      beforeEach(async () => {
        const bucket = {
          title: "Realtime Field ACL Bucket",
          description: "Test bucket for realtime field-level ACL",
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

        await req.post(
          `/bucket/${bucketId}/data`,
          {title: "Test Document", secret_info: "Hidden Data"},
          {Authorization: `IDENTITY ${identityToken}`}
        );
      });

      it("should include field when field-level ACL allows access for USER token", done => {
        const messageSpy = jest.fn();
        const lastMessage = JSON.stringify({kind: ChunkKind.EndOfInitial});

        const ws = wsc.get(`/bucket/${bucketId}/data`, {
          headers: {Authorization: `USER ${userToken}`}
        });

        ws.onmessage = async e => {
          messageSpy(JSON.parse(e.data as string));

          if (e.data == lastMessage) {
            const messages = messageSpy.mock.calls.map(c => c[0]);
            const initialDocs = messages.filter(m => m.kind === ChunkKind.Initial);

            expect(initialDocs.length).toBe(1);
            expect(initialDocs[0].document.title).toBe("Test Document");
            expect(initialDocs[0].document.secret_info).toBe("Hidden Data");

            await ws.close();
            done();
          }
        };

        ws.connect;
      });

      it("should exclude field when field-level ACL rejects access for USER token", done => {
        const messageSpy = jest.fn();
        const lastMessage = JSON.stringify({kind: ChunkKind.EndOfInitial});

        const ws = wsc.get(`/bucket/${bucketId}/data`, {
          headers: {Authorization: `USER ${aclRejectedUserToken}`}
        });

        ws.onmessage = async e => {
          messageSpy(JSON.parse(e.data as string));

          if (e.data == lastMessage) {
            const messages = messageSpy.mock.calls.map(c => c[0]);
            const initialDocs = messages.filter(m => m.kind === ChunkKind.Initial);

            expect(initialDocs.length).toBe(1);
            expect(initialDocs[0].document.title).toBe("Test Document");
            expect(initialDocs[0].document.secret_info).toBeUndefined();

            await ws.close();
            done();
          }
        };

        ws.connect;
      });
    });
  });
});
