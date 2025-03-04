import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket";
import {Bucket, BucketDocument} from "@spica-server/bucket/services";
import {SchemaModule} from "@spica-server/core/schema";
import {CREATED_AT, UPDATED_AT} from "@spica-server/core/schema/defaults";
import {DATE_TIME, OBJECTID_STRING, OBJECT_ID} from "@spica-server/core/schema/formats";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";

describe("BucketDataController", () => {
  let app: INestApplication;
  let req: Request;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        SchemaModule.forRoot({
          formats: [OBJECT_ID, DATE_TIME, OBJECTID_STRING],
          defaults: [CREATED_AT, UPDATED_AT]
        }),
        CoreTestingModule,
        PassportTestingModule.initialize(),
        DatabaseTestingModule.replicaSet(),
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
    req.reject = true; /* Reject for non 2xx response codes */
    await app.listen(req.socket);
  });

  afterEach(() => app.close());

  describe("index", () => {
    let bucket: any = {
      title: "Persons",
      description: "Person bucket",
      icon: "view_stream",
      primary: "title",
      properties: {
        name: {
          type: "string",
          title: "Name of the person",
          options: {position: "left"},
          maxLength: 20,
          minLength: 3
        },
        age: {
          type: "number",
          title: "Age of the person",
          options: {position: "right"}
        },
        created_at: {
          type: "date",
          title: "Creation Timestamp",
          options: {position: "bottom"}
        }
      }
    };

    let rows = [];

    beforeEach(async () => {
      bucket = await req.post("/bucket", bucket).then(response => response.body);
      rows = [
        await req.post(`/bucket/${bucket._id}/data`, {name: "Jim", age: 20}),
        await req.post(`/bucket/${bucket._id}/data`, {name: "Michael", age: 22}),
        await req.post(`/bucket/${bucket._id}/data`, {name: "Kevin", age: 25}),
        await req.post(`/bucket/${bucket._id}/data`, {name: "Dwight", age: 38}),
        await req.post(`/bucket/${bucket._id}/data`, {name: "Toby", age: 30})
      ].map(r => r.body);
    });

    it("should have created the bucket and the rows", () => {
      expect(bucket._id).toBeTruthy();

      expect(rows).toEqual([
        {_id: rows[0]._id, name: "Jim", age: 20},
        {_id: rows[1]._id, name: "Michael", age: 22},
        {_id: rows[2]._id, name: "Kevin", age: 25},
        {_id: rows[3]._id, name: "Dwight", age: 38},
        {_id: rows[4]._id, name: "Toby", age: 30}
      ]);
    });

    describe("skip and limit", () => {
      it("should work without query", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {});
        expect(documents.length).toEqual(5);

        expect(documents).toEqual([
          {_id: documents[0]._id, name: "Jim", age: 20},
          {_id: documents[1]._id, name: "Michael", age: 22},
          {_id: documents[2]._id, name: "Kevin", age: 25},
          {_id: documents[3]._id, name: "Dwight", age: 38},
          {_id: documents[4]._id, name: "Toby", age: 30}
        ]);
      });

      it("should work with limit query", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {limit: "3"});
        expect(documents.length).toEqual(3);
        expect(documents).toEqual([
          {_id: documents[0]._id, name: "Jim", age: 20},
          {_id: documents[1]._id, name: "Michael", age: 22},
          {_id: documents[2]._id, name: "Kevin", age: 25}
        ]);
      });

      it("should work with skip query", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {skip: "2"});
        expect(documents.length).toEqual(3);
        expect(documents).toEqual([
          {_id: documents[0]._id, name: "Kevin", age: 25},
          {_id: documents[1]._id, name: "Dwight", age: 38},
          {_id: documents[2]._id, name: "Toby", age: 30}
        ]);
      });

      it("should work with skip and limit query", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {
          limit: "2",
          skip: "1"
        });
        expect(documents.length).toEqual(2);
        expect(documents).toEqual([
          {_id: documents[0]._id, name: "Michael", age: 22},
          {_id: documents[1]._id, name: "Kevin", age: 25}
        ]);
      });
    });

    describe("sort", () => {
      it("ascend by name", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {
          sort: JSON.stringify({name: 1})
        });

        expect(documents.length).toBe(5);

        expect(documents).toEqual([
          {_id: documents[0]._id, name: "Dwight", age: 38},
          {_id: documents[1]._id, name: "Jim", age: 20},
          {_id: documents[2]._id, name: "Kevin", age: 25},
          {_id: documents[3]._id, name: "Michael", age: 22},
          {_id: documents[4]._id, name: "Toby", age: 30}
        ]);
      });

      it("descend by name", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {
          sort: JSON.stringify({name: -1})
        });

        expect(documents.length).toBe(5);

        expect(documents).toEqual([
          {_id: documents[0]._id, name: "Toby", age: 30},
          {_id: documents[1]._id, name: "Michael", age: 22},
          {_id: documents[2]._id, name: "Kevin", age: 25},
          {_id: documents[3]._id, name: "Jim", age: 20},
          {_id: documents[4]._id, name: "Dwight", age: 38}
        ]);
      });

      it("ascend by age", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {
          sort: JSON.stringify({age: 1})
        });

        expect(documents.length).toBe(5);
        expect(documents).toEqual([
          {_id: documents[0]._id, name: "Jim", age: 20},
          {_id: documents[1]._id, name: "Michael", age: 22},
          {_id: documents[2]._id, name: "Kevin", age: 25},
          {_id: documents[3]._id, name: "Toby", age: 30},
          {_id: documents[4]._id, name: "Dwight", age: 38}
        ]);
      });

      it("descend by age", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {
          sort: JSON.stringify({age: -1})
        });

        expect(documents.length).toBe(5);
        expect(documents).toEqual([
          {_id: documents[0]._id, name: "Dwight", age: 38},
          {_id: documents[1]._id, name: "Toby", age: 30},
          {_id: documents[2]._id, name: "Kevin", age: 25},
          {_id: documents[3]._id, name: "Michael", age: 22},
          {_id: documents[4]._id, name: "Jim", age: 20}
        ]);
      });
    });

    describe("pagination", () => {
      it("should paginate the results", async () => {
        const {body: response} = await req.get(`/bucket/${bucket._id}/data`, {paginate: "true"});
        expect(response.meta.total).toBe(5);
        expect(response.data.length).toBe(5);

        expect(response.data).toEqual([
          {_id: response.data[0]._id, name: "Jim", age: 20},
          {_id: response.data[1]._id, name: "Michael", age: 22},
          {_id: response.data[2]._id, name: "Kevin", age: 25},
          {_id: response.data[3]._id, name: "Dwight", age: 38},
          {_id: response.data[4]._id, name: "Toby", age: 30}
        ]);
      });

      it("should paginate the results along with the limit", async () => {
        const {body: response} = await req.get(`/bucket/${bucket._id}/data`, {
          limit: "2",
          paginate: "true"
        });
        expect(response.meta.total).toBe(5);
        expect(response.data.length).toBe(2);
        expect(response.data).toEqual([
          {_id: response.data[0]._id, name: "Jim", age: 20},
          {_id: response.data[1]._id, name: "Michael", age: 22}
        ]);
      });

      it("should paginate the results along with the skip", async () => {
        const {body: response} = await req.get(`/bucket/${bucket._id}/data`, {
          skip: "3",
          paginate: "true"
        });
        expect(response.meta.total).toBe(5);
        expect(response.data.length).toBe(2);

        expect(response.data).toEqual([
          {_id: response.data[0]._id, name: "Dwight", age: 38},
          {_id: response.data[1]._id, name: "Toby", age: 30}
        ]);
      });

      it("should paginate the results along with the skip and limit", async () => {
        const {body: response} = await req.get(`/bucket/${bucket._id}/data`, {
          limit: "3",
          skip: "2",
          paginate: "true"
        });
        expect(response.meta.total).toBe(5);
        expect(response.data.length).toBe(3);

        expect(response.data).toEqual([
          {_id: response.data[0]._id, name: "Kevin", age: 25},
          {_id: response.data[1]._id, name: "Dwight", age: 38},
          {_id: response.data[2]._id, name: "Toby", age: 30}
        ]);
      });
    });

    describe("filter", () => {
      it("should return the persons who has 'i' in their names", async () => {
        const {body: response} = await req.get(`/bucket/${bucket._id}/data`, {
          filter: JSON.stringify({name: {$regex: "i"}})
        });

        expect(response.length).toBe(4);
        expect(response).toEqual([
          {_id: response[0]._id, name: "Jim", age: 20},
          {_id: response[1]._id, name: "Michael", age: 22},
          {_id: response[2]._id, name: "Kevin", age: 25},
          {_id: response[3]._id, name: "Dwight", age: 38}
        ]);
      });

      it("should return the persons whose name is Jim", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {
          filter: JSON.stringify({name: "Jim"})
        });

        expect(documents.length).toBe(1);
        expect(documents).toEqual([{_id: documents[0]._id, name: "Jim", age: 20}]);
      });

      it("should return the persons whose name is Jim (Expression)", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {
          filter: `name == "Jim"`
        });

        expect(documents.length).toBe(1);
        expect(documents).toEqual([{_id: documents[0]._id, name: "Jim", age: 20}]);
      });

      it("should return the persons whose age is 38", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {
          filter: JSON.stringify({age: 38})
        });

        expect(documents.length).toBe(1);
        expect(documents).toEqual([{_id: documents[0]._id, name: "Dwight", age: 38}]);
      });

      it("should return the persons whose age is 38 (Expression)", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {
          filter: `age == 38`
        });

        expect(documents.length).toBe(1);
        expect(documents).toEqual([{_id: documents[0]._id, name: "Dwight", age: 38}]);
      });

      it("should return the persons who is older than 22", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {
          filter: JSON.stringify({age: {$gt: 22}})
        });

        expect(documents.length).toBe(3);
        expect(documents).toEqual([
          {_id: documents[0]._id, name: "Kevin", age: 25},
          {_id: documents[1]._id, name: "Dwight", age: 38},
          {_id: documents[2]._id, name: "Toby", age: 30}
        ]);
      });

      it("should return the persons who is older than 22 (Expression)", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {
          filter: `age > 22`
        });

        expect(documents.length).toBe(3);
        expect(documents).toEqual([
          {_id: documents[0]._id, name: "Kevin", age: 25},
          {_id: documents[1]._id, name: "Dwight", age: 38},
          {_id: documents[2]._id, name: "Toby", age: 30}
        ]);
      });

      it("should return the persons who is younger than 25", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {
          filter: JSON.stringify({age: {$lt: 25}})
        });

        expect(documents.length).toBe(2);
        expect(documents).toEqual([
          {_id: documents[0]._id, name: "Jim", age: 20},
          {_id: documents[1]._id, name: "Michael", age: 22}
        ]);
      });

      it("should return the persons who is younger than 25 (Expression)", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {
          filter: `age < 25`
        });

        expect(documents.length).toBe(2);
        expect(documents).toEqual([
          {_id: documents[0]._id, name: "Jim", age: 20},
          {_id: documents[1]._id, name: "Michael", age: 22}
        ]);
      });

      describe("advanced filter", () => {
        let rows;
        beforeEach(async () => {
          rows = [
            await req.post(`/bucket/${bucket._id}/data`, {
              name: "Sherlock",
              age: 28,
              created_at: new Date("2020-04-20T10:00:00.000Z")
            }),
            await req.post(`/bucket/${bucket._id}/data`, {
              name: "Doctor Who",
              age: 25,
              created_at: new Date("2020-05-20T10:00:00.000Z")
            })
          ].map(r => r.body);
        });

        it("should get documents between dates", async () => {
          const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {
            filter: JSON.stringify({
              created_at: {
                $gte: `Date(2020-04-20T10:00:00.000Z)`,
                $lt: `Date(2020-05-20T10:00:00.000Z)`
              }
            })
          });

          expect(documents).toEqual([
            {
              _id: documents[0]._id,
              name: "Sherlock",
              age: 28,
              created_at: "2020-04-20T10:00:00.000Z"
            }
          ]);
        });

        it("should get documents whose creation date is the greatest", async () => {
          const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {
            filter: JSON.stringify({
              created_at: {
                $gt: `Date(${new Date("2020-04-20T10:00:00.000Z").toISOString()})`
              }
            })
          });

          expect(documents).toEqual([
            {
              _id: documents[0]._id,
              name: "Doctor Who",
              age: 25,
              created_at: "2020-05-20T10:00:00.000Z"
            }
          ]);
        });

        it("should throw error if the advanced filter constructor does not exist", async () => {
          const {body: error} = await req
            .get(`/bucket/${bucket._id}/data`, {
              filter: JSON.stringify({
                created_at: {
                  $gt: `Throw(${new Date("2020-04-20T10:00:00.000Z").toISOString()})`
                }
              })
            })
            .catch(e => e);
          expect(error).toEqual({
            statusCode: 400,
            message:
              'Could not find the constructor Throw in {"$gt":"Throw(2020-04-20T10:00:00.000Z)"}'
          });
        });
      });
    });

    describe("localize", () => {
      let bucket: Bucket;
      let rows: BucketDocument[];
      beforeEach(async () => {
        bucket = await req
          .post("/bucket", {
            title: "New Bucket",
            description: "Describe your new bucket",
            icon: "view_stream",
            primary: "title",
            readOnly: false,
            properties: {
              title: {
                type: "string",
                title: "title",
                description: "Title of the row",
                options: {position: "left", translate: true}
              },
              description: {
                type: "textarea",
                title: "description",
                description: "Description of the row",
                options: {position: "right"}
              }
            }
          })
          .then(r => r.body);

        rows = [
          await req.post(`/bucket/${bucket._id}/data`, {
            title: {en_US: "english words", tr_TR: "türkçe kelimeler"},
            description: "description"
          }),
          await req.post(`/bucket/${bucket._id}/data`, {
            title: {en_US: "new english words", tr_TR: "yeni türkçe kelimeler"},
            description: "description"
          }),
          await req.post(`/bucket/${bucket._id}/data`, {
            title: {en_US: "only english words"},
            description: "description"
          })
        ].map(r => r.body);
      });

      afterEach(async () => await req.delete(`/bucket/${bucket._id}`));

      describe("find requests", () => {
        it("should return english titles", async () => {
          const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, undefined, {
            "accept-language": "en_US"
          });
          expect(documents).toEqual([
            {_id: documents[0]._id, title: "english words", description: "description"},
            {_id: documents[1]._id, title: "new english words", description: "description"},
            {_id: documents[2]._id, title: "only english words", description: "description"}
          ]);
        });

        it("should return turkish titles and fallback to default language", async () => {
          const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, undefined, {
            "accept-language": "tr_TR"
          });

          expect(documents).toEqual([
            {_id: documents[0]._id, title: "türkçe kelimeler", description: "description"},
            {_id: documents[1]._id, title: "yeni türkçe kelimeler", description: "description"},
            {_id: documents[2]._id, title: "only english words", description: "description"}
          ]);
        });

        it("should return documents as is when localize parameter is false", async () => {
          const {body: documents} = await req.get(
            `/bucket/${bucket._id}/data`,
            {localize: "false"},
            {"accept-language": "tr_TR"}
          );

          expect(documents).toEqual([
            {
              _id: documents[0]._id,
              title: {en_US: "english words", tr_TR: "türkçe kelimeler"},
              description: "description"
            },
            {
              _id: documents[1]._id,
              title: {en_US: "new english words", tr_TR: "yeni türkçe kelimeler"},
              description: "description"
            },
            {
              _id: documents[2]._id,
              title: {en_US: "only english words"},
              description: "description"
            }
          ]);
        });

        it("should return fallback language's titles when the titles are not available in requested language", async () => {
          const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, undefined, {
            "accept-language": "fr_FR"
          });
          expect(documents).toEqual([
            {_id: documents[0]._id, title: "english words", description: "description"},
            {_id: documents[1]._id, title: "new english words", description: "description"},
            {_id: documents[2]._id, title: "only english words", description: "description"}
          ]);
        });
      });

      describe("findOne requests", () => {
        it("should return English title ", async () => {
          const {body: document} = await req.get(
            `/bucket/${bucket._id}/data/${rows[0]._id}`,
            undefined,
            {"accept-language": "en_US"}
          );
          expect(document).toEqual({
            _id: document._id,
            title: "english words",
            description: "description"
          });
        });

        it("should return Turkish title ", async () => {
          const {body: document} = await req.get(
            `/bucket/${bucket._id}/data/${rows[0]._id}`,
            undefined,
            {"accept-language": "tr_TR"}
          );
          expect(document).toEqual({
            _id: document._id,
            title: "türkçe kelimeler",
            description: "description"
          });
        });

        it("should return document as is when localize parameter is false", async () => {
          const {body: document} = await req.get(
            `/bucket/${bucket._id}/data/${rows[0]._id}`,
            {localize: "false"},
            {"accept-language": "tr_TR"}
          );
          expect(document).toEqual({
            _id: document._id,
            title: {en_US: "english words", tr_TR: "türkçe kelimeler"},
            description: "description"
          });
        });

        it("should return fallback language's titles when the titles are not available in requested language", async () => {
          const {body: document} = await req.get(
            `/bucket/${bucket._id}/data/${rows[2]._id}`,
            undefined,
            {"accept-language": "tr_TR"}
          );
          expect(document).toEqual({
            _id: document._id,
            title: "only english words",
            description: "description"
          });
        });
      });
    });

    describe("relation", () => {
      let statisticsBucket: Bucket;
      let usersBucket: Bucket;
      let achievementsBucket: Bucket;
      let walletBucket: Bucket;

      let user: BucketDocument;
      let anotherUser: BucketDocument;
      let userWithWallet: BucketDocument;
      let achievement: BucketDocument;
      let wallets: BucketDocument[];

      let userWithWalletStats: BucketDocument;

      beforeEach(async () => {
        achievementsBucket = await req
          .post("/bucket", {
            title: "Achievement",
            description: "Achievement",
            properties: {
              name: {
                type: "string"
              }
            }
          })
          .then(r => r.body);

        walletBucket = await req
          .post("/bucket", {
            title: "Wallet",
            description: "Wallet",
            properties: {
              name: {
                type: "string"
              }
            }
          })
          .then(r => r.body);

        usersBucket = await req
          .post("/bucket", {
            title: "User",
            description: "Users",
            properties: {
              name: {
                type: "string"
              },
              wallet: {
                type: "relation",
                bucketId: walletBucket._id,
                relationType: "onetomany"
              }
            }
          })
          .then(r => r.body);

        statisticsBucket = await req
          .post("/bucket", {
            title: "Statistics",
            description: "Statistics",
            properties: {
              achievement: {
                type: "relation",
                options: {position: "left"},
                bucketId: achievementsBucket._id,
                relationType: "onetoone"
              },
              user: {
                type: "relation",
                options: {position: "right"},
                bucketId: usersBucket._id,
                relationType: "onetoone"
              }
            }
          })
          .then(r => r.body);

        user = await req
          .post(`/bucket/${usersBucket._id}/data`, {
            name: "user66"
          })
          .then(r => r.body);

        achievement = await req
          .post(`/bucket/${achievementsBucket._id}/data`, {
            name: "do something until something else happens"
          })
          .then(r => r.body);

        anotherUser = await req
          .post(`/bucket/${usersBucket._id}/data`, {
            name: "user33"
          })
          .then(r => r.body);

        wallets = [
          await req.post(`/bucket/${walletBucket._id}/data`, {
            name: "GNB"
          }),
          await req.post(`/bucket/${walletBucket._id}/data`, {
            name: "FNB"
          })
        ].map(r => r.body);

        userWithWallet = await req
          .post(`/bucket/${usersBucket._id}/data`, {
            name: "wealthy user",
            wallet: wallets.map(wallet => wallet._id)
          })
          .then(r => r.body);

        await req.post(`/bucket/${statisticsBucket._id}/data`, {
          user: user._id,
          achievement: achievement._id
        });

        await req.post(`/bucket/${statisticsBucket._id}/data`, {
          user: anotherUser._id,
          achievement: achievement._id
        });

        userWithWalletStats = await req
          .post(`/bucket/${statisticsBucket._id}/data`, {
            user: userWithWallet._id,
            achievement: achievement._id
          })
          .then(r => r.body);
      });

      afterEach(async () => {
        await req.delete(`/bucket/${statisticsBucket._id}`);
        await req.delete(`/bucket/${usersBucket._id}`);
        await req.delete(`/bucket/${achievementsBucket._id}`);
        await req.delete(`/bucket/${walletBucket._id}`);
      });

      describe("findAll", () => {
        it("should return users with wallets", async () => {
          const {body: users} = await req.get(`/bucket/${usersBucket._id}/data`, {relation: true});
          expect(users).toEqual([
            {_id: users[0]._id, name: "user66", wallet: []},
            {_id: users[1]._id, name: "user33", wallet: []},
            {
              _id: users[2]._id,
              name: "wealthy user",
              wallet: [
                {_id: users[2].wallet[0]._id, name: "GNB"},
                {_id: users[2].wallet[1]._id, name: "FNB"}
              ]
            }
          ]);
        });

        it("should return users by their wallet name", async () => {
          const {body: users} = await req.get(`/bucket/${usersBucket._id}/data`, {
            relation: true,
            filter: JSON.stringify({"wallet.name": "GNB"})
          });
          expect(users).toEqual([
            {
              _id: users[0]._id,
              name: "wealthy user",
              wallet: [
                {_id: users[0].wallet[0]._id, name: "GNB"},
                {_id: users[0].wallet[1]._id, name: "FNB"}
              ]
            }
          ]);
        });

        it("should get statistics with username and achievement name", async () => {
          const {body: documents} = await req.get(`/bucket/${statisticsBucket._id}/data`, {
            relation: true
          });
          expect(documents).toEqual([
            {
              _id: documents[0]._id,
              user: {
                _id: documents[0].user._id,
                name: "user66"
              },
              achievement: {
                _id: documents[0].achievement._id,
                name: "do something until something else happens"
              }
            },
            {
              _id: documents[1]._id,
              user: {
                _id: documents[1].user._id,
                name: "user33"
              },
              achievement: {
                _id: documents[1].achievement._id,
                name: "do something until something else happens"
              }
            },
            {
              _id: documents[2]._id,
              user: {
                _id: documents[2].user._id,
                name: "wealthy user",
                wallet: wallets.map(w => w._id)
              },
              achievement: {
                _id: documents[2].achievement._id,
                name: "do something until something else happens"
              }
            }
          ]);
        });

        it("should get statistics with achievement,user and their wallets", async () => {
          const {body: documents} = await req.get(`/bucket/${statisticsBucket._id}/data`, {
            relation: ["user.wallet", "achievement"]
          });
          expect(documents).toEqual([
            {
              _id: documents[0]._id,
              user: {
                _id: documents[0].user._id,
                name: "user66",
                wallet: []
              },
              achievement: {
                _id: documents[0].achievement._id,
                name: "do something until something else happens"
              }
            },
            {
              _id: documents[1]._id,
              user: {
                _id: documents[1].user._id,
                name: "user33",
                wallet: []
              },
              achievement: {
                _id: documents[1].achievement._id,
                name: "do something until something else happens"
              }
            },
            {
              _id: documents[2]._id,
              user: {
                _id: documents[2].user._id,
                name: "wealthy user",
                wallet: [
                  {_id: documents[2].user.wallet[0]._id, name: "GNB"},
                  {_id: documents[2].user.wallet[1]._id, name: "FNB"}
                ]
              },
              achievement: {
                _id: documents[2].achievement._id,
                name: "do something until something else happens"
              }
            }
          ]);
        });

        it("should filter statistics by user wallet", async () => {
          const {body: documents} = await req.get(`/bucket/${statisticsBucket._id}/data`, {
            relation: ["user.wallet", "achievement"],
            filter: JSON.stringify({"user.wallet.name": "GNB"})
          });
          expect(documents).toEqual([
            {
              _id: documents[0]._id,
              user: {
                _id: documents[0].user._id,
                name: "wealthy user",
                wallet: [
                  {_id: documents[0].user.wallet[0]._id, name: "GNB"},
                  {_id: documents[0].user.wallet[1]._id, name: "FNB"}
                ]
              },
              achievement: {
                _id: documents[0].achievement._id,
                name: "do something until something else happens"
              }
            }
          ]);
        });

        it("should get statistics with only id", async () => {
          const {body: documents} = await req.get(`/bucket/${statisticsBucket._id}/data`, {
            relation: false
          });

          expect(documents).toEqual([
            {
              _id: documents[0]._id,
              user: user._id,
              achievement: achievement._id
            },
            {
              _id: documents[1]._id,
              user: anotherUser._id,
              achievement: achievement._id
            },
            {
              _id: documents[2]._id,
              user: userWithWallet._id,
              achievement: achievement._id
            }
          ]);
        });

        it("should return the documents including those which does not have the relation field filled", async () => {
          const {body: newRow} = await req.post(`/bucket/${statisticsBucket._id}/data`, {});
          const {body: documents} = await req.get(`/bucket/${statisticsBucket._id}/data`, {
            relation: true
          });
          expect(documents).toEqual([
            {
              _id: documents[0]._id,
              user: {
                _id: documents[0].user._id,
                name: "user66"
              },
              achievement: {
                _id: documents[0].achievement._id,
                name: "do something until something else happens"
              }
            },
            {
              _id: documents[1]._id,
              user: {
                _id: documents[1].user._id,
                name: "user33"
              },
              achievement: {
                _id: documents[1].achievement._id,
                name: "do something until something else happens"
              }
            },
            {
              _id: documents[2]._id,
              user: {
                _id: documents[2].user._id,
                name: "wealthy user",
                wallet: wallets.map(w => w._id)
              },
              achievement: {
                _id: documents[2].achievement._id,
                name: "do something until something else happens"
              }
            },
            {
              _id: newRow._id
            }
          ]);
        });

        it("should filter by relation", async () => {
          const {body: documents} = await req.get(`/bucket/${statisticsBucket._id}/data`, {
            relation: true,
            filter: JSON.stringify({"user._id": anotherUser._id})
          });

          expect(documents).toEqual([
            {
              _id: documents[0]._id,
              user: {
                _id: documents[0].user._id,
                name: "user33"
              },
              achievement: {
                _id: documents[0].achievement._id,
                name: "do something until something else happens"
              }
            }
          ]);
        });

        it("should not resolve relation and apply the filter correctly", async () => {
          const {body: documents} = await req.get(`/bucket/${statisticsBucket._id}/data`, {
            filter: JSON.stringify({user: anotherUser._id})
          });

          expect(documents).toEqual([
            {
              _id: documents[0]._id,
              user: anotherUser._id,
              achievement: achievement._id
            }
          ]);
        });

        describe("Multiple relational request", () => {
          afterEach(async () => {
            await req.put(`/bucket/${statisticsBucket._id}`, {
              ...statisticsBucket,
              acl: {
                write: "true==true",
                read: "true==true"
              }
            });
          });

          it("should run with rule and filter", async () => {
            await req.put(`/bucket/${statisticsBucket._id}`, {
              ...statisticsBucket,
              acl: {
                write: "true==true",
                read: `document.user._id=='${user._id}'`
              }
            });

            const filter = JSON.stringify({user: user._id});

            const {body: documents} = await req.get(`/bucket/${statisticsBucket._id}/data`, {
              filter
            });

            // resolve relation before apply rule, then apply rule
            // reset resolved relations that comes from rules
            // apply filter

            expect(documents).toEqual([
              {
                _id: documents[0]._id,
                user: user._id,
                achievement: achievement._id
              }
            ]);
          });

          it("should run when filter is a child of requested relation", async () => {
            const filter = JSON.stringify({"user.name": "wealthy user"});
            const relation = ["user.wallet", "achievement"];

            const {body: documents} = await req.get(`/bucket/${statisticsBucket._id}/data`, {
              filter,
              relation
            });

            expect(documents).toEqual([
              {
                _id: documents[0]._id,
                user: {
                  _id: documents[0].user._id,
                  name: "wealthy user",
                  wallet: [
                    {_id: documents[0].user.wallet[0]._id, name: "GNB"},
                    {_id: documents[0].user.wallet[1]._id, name: "FNB"}
                  ]
                },
                achievement: {
                  _id: documents[0].achievement._id,
                  name: "do something until something else happens"
                }
              }
            ]);
          });
        });
      });

      describe("find", () => {
        it("should get statistic with achievement,user and own wallets", async () => {
          const {body: document} = await req.get(
            `/bucket/${statisticsBucket._id}/data/${userWithWalletStats._id}`,
            {
              relation: true
            }
          );
          expect(document).toEqual({
            _id: document._id,
            user: {
              _id: document.user._id,
              name: "wealthy user",
              wallet: wallets.map(w => w._id)
            },
            achievement: {
              _id: document.achievement._id,
              name: "do something until something else happens"
            }
          });
        });

        it("should get statistic with username id and achievement id", async () => {
          const {body: document} = await req.get(
            `/bucket/${statisticsBucket._id}/data/${userWithWalletStats._id}`,
            {
              relation: false
            }
          );
          expect(document).toEqual({
            _id: document._id,
            user: userWithWallet._id,
            achievement: achievement._id
          });
        });

        it("should get statistic with user and own wallet", async () => {
          const {body: document} = await req.get(
            `/bucket/${statisticsBucket._id}/data/${userWithWalletStats._id}`,
            {
              relation: ["user.wallet"]
            }
          );
          expect(document).toEqual({
            _id: document._id,
            user: {
              _id: document.user._id,
              name: "wealthy user",
              wallet: [
                {_id: document.user.wallet[0]._id, name: "GNB"},
                {_id: document.user.wallet[1]._id, name: "FNB"}
              ]
            },
            achievement: achievement._id
          });
        });
      });
    });
  });

  describe("post,put,patch requests", () => {
    let myBucketId: string;
    beforeEach(async () => {
      const myBucket = {
        title: "New Bucket",
        description: "Describe your new bucket",
        icon: "view_stream",
        primary: "title",
        readOnly: false,
        properties: {
          title: {
            type: "string",
            title: "title",
            description: "Title of the row",
            options: {position: "left"}
          },
          description: {
            type: "textarea",
            title: "description",
            description: "Description of the row",
            options: {position: "right"}
          }
        }
      };
      const {body} = await req.post("/bucket", myBucket);
      myBucketId = body._id;
    });

    describe("post", () => {
      it("should insert document to bucket and return inserted document", async () => {
        const insertedDocument = (
          await req.post(`/bucket/${myBucketId}/data`, {
            title: "first title",
            description: "first description"
          })
        ).body;

        const bucketDocument = (
          await req.get(`/bucket/${myBucketId}/data/${insertedDocument._id}`, {})
        ).body;

        expect(bucketDocument).toEqual(insertedDocument);

        delete insertedDocument._id;
        expect(insertedDocument).toEqual({title: "first title", description: "first description"});
      });

      it("should insert document with id", async () => {
        const _id = new ObjectId();
        const insertedDocument = (
          await req.post(`/bucket/${myBucketId}/data`, {
            _id: _id,
            title: "first title",
            description: "first description"
          })
        ).body;

        const bucketDocument = (await req.get(`/bucket/${myBucketId}/data/${_id}`, {})).body;

        expect(bucketDocument).toEqual(insertedDocument);
        expect(insertedDocument).toEqual({
          _id: _id.toHexString(),
          title: "first title",
          description: "first description"
        });
      });

      it("should return error if id is not valid", async () => {
        const _id = "invalid_objectid";

        const response = await req
          .post(`/bucket/${myBucketId}/data`, {
            _id: _id,
            title: "title",
            description: "description"
          })
          .catch(e => e);
        expect(response.statusCode).toBe(400);
        expect(response.statusText).toBe("Bad Request");
        expect(response.body).toEqual({
          statusCode: 400,
          message: '._id should match format "objectid"',
          error: "validation failed"
        });
      });

      it("should return error if id has already exist", async () => {
        const existingId = await req
          .post(`/bucket/${myBucketId}/data`, {
            title: "title",
            description: "description"
          })
          .then(r => r.body._id);

        const response = await req
          .post(`/bucket/${myBucketId}/data`, {
            _id: existingId,
            title: "title2",
            description: "description2"
          })
          .catch(e => e);
        expect(response.statusCode).toBe(400);
        expect(response.statusText).toBe("Bad Request");
        expect(response.body).toEqual({
          statusCode: 400,
          message: "Value of the property ._id should unique across all documents."
        });
      });

      it("should return error if title isnt valid for bucket", async () => {
        const response = await req
          .post(`/bucket/${myBucketId}/data`, {
            title: true,
            description: "description"
          })
          .then(() => null)
          .catch(e => e);
        expect(response.statusCode).toBe(400);
        expect(response.statusText).toBe("Bad Request");
        expect(response.body).toEqual({
          statusCode: 400,
          message: ".title must be string",
          error: "validation failed"
        });
      });
    });

    describe("put/patch", () => {
      let insertedDocument;
      beforeEach(async () => {
        const {body} = await req.post(`/bucket/${myBucketId}/data`, {
          title: "first title",
          description: "first description"
        });
        insertedDocument = body;
      });

      it("should update document", async () => {
        const {body: updatedDocument} = await req.put(
          `/bucket/${myBucketId}/data/${insertedDocument._id}`,
          {
            ...insertedDocument,
            title: "updated title"
          }
        );
        const {body: bucketDocument} = await req.get(
          `/bucket/${myBucketId}/data/${updatedDocument._id}`
        );
        expect(bucketDocument).toEqual(updatedDocument);
        expect(updatedDocument).toEqual({
          _id: updatedDocument._id,
          title: "updated title",
          description: "first description"
        });
      });

      it("should patch document", async () => {
        const response = await req.patch(`/bucket/${myBucketId}/data/${insertedDocument._id}`, {
          title: "new_title",
          description: null
        });

        expect(response.statusCode).toEqual(200);
        expect(response.body).toEqual({_id: insertedDocument._id, title: "new_title"});
      });

      it("should throw error when patched document is not valid", async () => {
        const response = await req
          .patch(`/bucket/${myBucketId}/data/${insertedDocument._id}`, {
            title: 1001
          })
          .catch(e => e);

        expect(response.statusCode).toBe(400);
        expect(response.statusText).toBe("Bad Request");
        expect(response.body).toEqual({
          statusCode: 400,
          message: ".title must be string",
          error: "validation failed"
        });
      });

      it("should throw error when put document does not exist", async () => {
        const response = await req
          .patch(`/bucket/${myBucketId}/data/000000000000000000000000`, {
            title: null
          })
          .catch(e => e);

        expect(response.statusCode).toBe(404);
        expect(response.statusText).toBe("Not Found");
        expect(response.body).toEqual({
          statusCode: 404,
          message: `Could not find the document with id 000000000000000000000000`,
          error: "Not Found"
        });
      });

      it("should throw error when patched document does not exist", async () => {
        const response = await req
          .put(`/bucket/${myBucketId}/data/000000000000000000000000`, {
            title: "test"
          })
          .catch(e => e);

        expect(response.statusCode).toBe(404);
        expect(response.statusText).toBe("Not Found");
        expect(response.body).toEqual({
          statusCode: 404,
          message: `Could not find the document with id 000000000000000000000000`,
          error: "Not Found"
        });
      });
    });

    it("should return error if description isnt valid for bucket", async () => {
      const response = await req
        .post(`/bucket/${myBucketId}/data`, {
          title: "title",
          description: [1, 2, 3]
        })
        .catch(e => e);
      expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
      expect([response.body.error, response.body.message]).toEqual([
        "validation failed",
        ".description must be string"
      ]);
    });
  });

  describe("insert with limitations", () => {
    describe("prevent inserting", () => {
      let bucketId: string;
      let bucket;
      beforeEach(async () => {
        bucket = {
          title: "New Bucket",
          description: "Describe your new bucket",
          icon: "view_stream",
          primary: "title",
          readOnly: false,
          properties: {
            title: {
              type: "string",
              title: "title",
              description: "Title of the row",
              options: {position: "left"}
            },
            description: {
              type: "textarea",
              title: "description",
              description: "Description of the row",
              options: {position: "right"}
            }
          },
          documentSettings: {
            countLimit: 1,
            limitExceedBehaviour: "prevent"
          }
        };
        const {body} = await req.post("/bucket", bucket);
        bucketId = body._id;
      });

      it("should throw error and prevent inserting when limit reached", async () => {
        const {body: document1} = await req.post(`/bucket/${bucketId}/data`, {
          title: "first title",
          description: "first description"
        });

        expect(document1).toEqual({
          _id: document1._id,
          title: "first title",
          description: "first description"
        });

        const response = await req
          .post(`/bucket/${bucketId}/data`, {
            title: "second title",
            description: "second description"
          })
          .catch(e => e);

        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect(response.body.message).toEqual(
          "Database error: Maximum number of documents has been reached"
        );
      });

      it("should disable document count limitation", async () => {
        delete bucket.documentSettings;
        await req.put(`/bucket/${bucketId}`, bucket);

        const {body: document1} = await req.post(`/bucket/${bucketId}/data`, {
          title: "first title",
          description: "first description"
        });

        expect(document1).toEqual({
          _id: document1._id,
          title: "first title",
          description: "first description"
        });

        const {body: document2} = await req.post(`/bucket/${bucketId}/data`, {
          title: "second title",
          description: "second description"
        });

        expect(document2).toEqual({
          _id: document2._id,
          title: "second title",
          description: "second description"
        });
      });
    });

    describe("insert and remove oldest document", () => {
      let bucketId: string;
      let bucket;
      beforeEach(async () => {
        bucket = {
          title: "New Bucket",
          description: "Describe your new bucket",
          icon: "view_stream",
          primary: "title",
          readOnly: false,
          properties: {
            title: {
              type: "string",
              title: "title",
              description: "Title of the row",
              options: {position: "left"}
            },
            description: {
              type: "textarea",
              title: "description",
              description: "Description of the row",
              options: {position: "right"}
            }
          },
          documentSettings: {
            countLimit: 1,
            limitExceedBehaviour: "remove"
          }
        };
        const {body} = await req.post("/bucket", bucket);
        bucketId = body._id;
      });

      it("should insert document but remove the oldest document of bucket", async () => {
        const {body: document1} = await req.post(`/bucket/${bucketId}/data`, {
          title: "first title",
          description: "first description"
        });

        expect(document1).toEqual({
          _id: document1._id,
          title: "first title",
          description: "first description"
        });

        const {body: document2} = await req.post(`/bucket/${bucketId}/data`, {
          title: "second title",
          description: "second description"
        });

        expect(document2).toEqual({
          _id: document2._id,
          title: "second title",
          description: "second description"
        });

        const {body: documents} = await req.get(`/bucket/${bucketId}/data`);
        expect(documents).toEqual([
          {
            _id: documents[0]._id,
            title: "second title",
            description: "second description"
          }
        ]);
      });

      it("should disable document count limitation", async () => {
        delete bucket.documentSettings;
        await req.put(`/bucket/${bucketId}`, bucket);

        const {body: document1} = await req.post(`/bucket/${bucketId}/data`, {
          title: "first title",
          description: "first description"
        });

        expect(document1).toEqual({
          _id: document1._id,
          title: "first title",
          description: "first description"
        });

        const {body: document2} = await req.post(`/bucket/${bucketId}/data`, {
          title: "second title",
          description: "second description"
        });

        expect(document2).toEqual({
          _id: document2._id,
          title: "second title",
          description: "second description"
        });

        const {body: documents} = await req.get(`/bucket/${bucketId}/data`);
        expect(documents).toEqual([
          {
            _id: documents[0]._id,
            title: "first title",
            description: "first description"
          },
          {
            _id: documents[1]._id,
            title: "second title",
            description: "second description"
          }
        ]);
      });
    });
  });

  describe("delete requests", () => {
    let myBucketId: ObjectId;
    let myBucketData;

    beforeEach(async () => {
      const myBucket = {
        title: "New Bucket",
        description: "Describe your new bucket",
        icon: "view_stream",
        primary: "title",
        readOnly: false,
        properties: {
          title: {
            type: "string",
            title: "title",
            description: "Title of the row",
            options: {position: "left"}
          },
          description: {
            type: "textarea",
            title: "description",
            description: "Description of the row",
            options: {position: "right"}
          }
        }
      };
      myBucketId = new ObjectId((await req.post("/bucket", myBucket)).body._id);
      myBucketData = [
        {title: "first title", description: "first description"},
        {title: "last title", description: "last description"}
      ];

      //add data
      myBucketData[0]._id = new ObjectId(
        (await req.post(`/bucket/${myBucketId}/data`, myBucketData[0])).body._id
      );
      myBucketData[1]._id = new ObjectId(
        (await req.post(`/bucket/${myBucketId}/data`, myBucketData[1])).body._id
      );
    });

    it("should delete document", async () => {
      const response = await req.delete(`/bucket/${myBucketId}/data/${myBucketData[1]._id}`);
      expect(response.statusCode).toBe(204);
      expect(response.body).toBe(undefined);

      const bucketData = (await req.get(`/bucket/${myBucketId}/data`, {})).body;

      expect(bucketData.length).toBe(1);
      expect(bucketData[0].title).toBe("first title");
      expect(bucketData[0].description).toBe("first description");
    });

    it("should throw error when document does not exist", async () => {
      const response = await req
        .delete(`/bucket/${myBucketId}/data/000000000000000000000000`)
        .catch(e => e);

      expect(response.statusCode).toBe(404);
      expect(response.statusText).toBe("Not Found");
      expect(response.body).toEqual({
        statusCode: 404,
        message: `Could not find the document with id 000000000000000000000000`,
        error: "Not Found"
      });
    });
  });

  describe("relation disposal", () => {
    describe("clear relations", () => {
      let userBucket: string;
      let ticketBucket: string;
      let hallBucket: string;
      beforeEach(async () => {
        hallBucket = await req
          .post("/bucket", {
            title: "Halls",
            description: "Halls",
            properties: {
              title: {
                type: "string",
                title: "name"
              }
            }
          })
          .then(r => r.body._id);

        ticketBucket = await req
          .post("/bucket", {
            title: "Ticket",
            description: "Ticket",
            properties: {
              place: {
                type: "object",
                properties: {
                  hall: {
                    type: "relation",
                    bucketId: hallBucket,
                    relationType: "onetoone"
                  },
                  seat_number: {
                    type: "number"
                  }
                }
              }
            }
          })
          .then(r => r.body._id);

        userBucket = await req
          .post("/bucket", {
            title: "Users",
            description: "Users",
            properties: {
              name: {
                type: "string",
                title: "name"
              },
              tickets: {
                type: "relation",
                bucketId: ticketBucket,
                relationType: "onetomany"
              }
            }
          })

          .then(r => r.body._id);
      });

      it("should remove tickets from users when deleted", async () => {
        const {body: firstTicket} = await req.post(`/bucket/${ticketBucket}/data`, {});
        const {body: secondTicket} = await req.post(`/bucket/${ticketBucket}/data`, {});
        await req.post(`/bucket/${userBucket}/data`, {name: "first", tickets: [firstTicket._id]});
        await req.post(`/bucket/${userBucket}/data`, {
          name: "second",
          tickets: [firstTicket._id, secondTicket._id]
        });
        await req.delete(`/bucket/${ticketBucket}/data/${firstTicket._id}`);

        let {body: users} = await req.get(`/bucket/${userBucket}/data`);

        expect(users).toEqual([
          {
            _id: users[0]._id,
            name: "first",
            tickets: []
          },
          {
            _id: users[1]._id,
            name: "second",
            tickets: [secondTicket._id]
          }
        ]);
      });

      it("should remove halls from ticket when deleted", async () => {
        const {body: firstHall} = await req.post(`/bucket/${hallBucket}/data`, {
          title: "first hall"
        });

        await req.post(`/bucket/${ticketBucket}/data`, {
          place: {
            hall: firstHall._id,
            seat_number: 1
          }
        });

        await req.post(`/bucket/${ticketBucket}/data`, {
          place: {
            hall: firstHall._id,
            seat_number: 2
          }
        });

        await req.delete(`/bucket/${hallBucket}/data/${firstHall._id}`);

        const {body: tickets} = await req.get(`/bucket/${ticketBucket}/data`);

        expect(tickets).toEqual([
          {
            _id: tickets[0]._id,
            place: {seat_number: 1}
          },
          {
            _id: tickets[1]._id,
            place: {seat_number: 2}
          }
        ]);
      });
    });

    describe("dependents", () => {
      let companyBucket: string;
      let employeeBucket: string;
      let addressBucket: string;

      beforeEach(async () => {
        addressBucket = await req
          .post("/bucket", {
            title: "Address",
            description: "Address",
            properties: {
              street: {
                type: "string"
              },
              city: {
                type: "string"
              }
            }
          })
          .then(r => r.body._id);

        employeeBucket = await req
          .post("/bucket", {
            title: "Employee",
            description: "Employee",
            properties: {
              fullname: {
                type: "string"
              },
              address: {
                type: "relation",
                relationType: "onetoone",
                bucketId: addressBucket,
                dependent: true
              }
            }
          })
          .then(r => r.body._id);

        companyBucket = await req
          .post("/bucket", {
            title: "Company",
            description: "Company",
            properties: {
              name: {
                type: "string"
              },
              employees: {
                type: "relation",
                relationType: "onetomany",
                bucketId: employeeBucket,
                dependent: true
              }
            }
          })

          .then(r => r.body._id);
      });

      it("should remove employees and their addresses when company deleted", async () => {
        const {body: address1} = await req.post(`/bucket/${addressBucket}/data`, {
          street: "1235",
          city: "Tallinn"
        });
        const {body: address2} = await req.post(`/bucket/${addressBucket}/data`, {
          street: "3457",
          city: "Stockholm"
        });

        const {body: employee1} = await req.post(`/bucket/${employeeBucket}/data`, {
          fullname: "Stefanos Ardit",
          address: address1._id
        });
        const {body: employee2} = await req.post(`/bucket/${employeeBucket}/data`, {
          fullname: "Emil Hanna",
          address: address2._id
        });

        const {body: company} = await req.post(`/bucket/${companyBucket}/data`, {
          name: "Frostfire Corp",
          employees: [employee1._id, employee2._id]
        });

        const deleteResponse = await req.delete(`/bucket/${companyBucket}/data/${company._id}`);

        expect([deleteResponse.statusCode, deleteResponse.statusText, deleteResponse.body]).toEqual(
          [204, "No Content", undefined]
        );

        const {body: companies} = await req.get(`/bucket/${companyBucket}/data`);
        expect(companies).toEqual([]);

        const {body: employees} = await req.get(`/bucket/${employeeBucket}/data`);
        expect(employees).toEqual([]);

        const {body: addresses} = await req.get(`/bucket/${addressBucket}/data`);
        expect(addresses).toEqual([]);
      });
    });
  });

  describe("defaults and readonly", () => {
    let bucketId: string;

    beforeEach(async () => {
      const myBucket = {
        title: "New Bucket",
        description: "Describe your new bucket",
        icon: "view_stream",
        readOnly: false,
        properties: {
          //this value is the value of the field on document, if it is not specified, default value will be used.
          created_at: {
            type: "date",
            default: ":created_at"
          },
          //this value always the create date of document. Value of the field on document will be ignored.
          created_at_readonly: {
            type: "date",
            default: ":created_at",
            readOnly: true
          }
        }
      };
      bucketId = (await req.post("/bucket", myBucket)).body._id;
    });

    it("should work with default and readonly values", async () => {
      const date = new Date("1980-01-01");
      let document = {
        created_at: date,
        created_at_readonly: date
      };
      const insertedDocument = (await req.post(`/bucket/${bucketId}/data`, document)).body;

      expect(new Date(insertedDocument.created_at)).toEqual(date);
      expect(new Date(insertedDocument.created_at_readonly)).not.toEqual(date);
    });

    it("should put default values if field does not exist on document", async () => {
      const insertedDocument = (await req.post(`/bucket/${bucketId}/data`)).body;

      expect(new Date(insertedDocument.created_at)).toEqual(expect.any(Date));
      expect(new Date(insertedDocument.created_at_readonly)).toEqual(expect.any(Date));
    });
  });

  describe("unique fields", () => {
    let bucket;
    beforeEach(async () => {
      const body = {
        title: "new bucket",
        description: "new bucket",
        properties: {
          title: {
            type: "string",
            options: {
              position: "right",
              unique: true
            }
          },
          description: {
            type: "string",
            options: {
              position: "right"
            }
          }
        }
      };

      bucket = await req.post("/bucket", body).then(r => r.body);
    });

    it("should insert documents when they have unique values", async () => {
      let document = {
        title: "Rat Of The Eternal",
        description: "Description of book"
      };

      let response = await req.post(`/bucket/${bucket._id}/data`, document);
      expect([response.statusCode, response.statusText]).toEqual([201, "Created"]);

      document.title = "Hawk Without Hate";

      response = await req.post(`/bucket/${bucket._id}/data`, document);
      expect([response.statusCode, response.statusText]).toEqual([201, "Created"]);
    });

    it("should update document when updated one have unique value", async () => {
      let document = {
        _id: undefined,
        title: "Men Without Faith",
        description: "Description of book"
      };

      let response = await req.post(`/bucket/${bucket._id}/data`, document).then(res => {
        document = res.body;
        return res;
      });
      expect([response.statusCode, response.statusText]).toEqual([201, "Created"]);

      document.title = "Creators Of The Day";

      response = await req.put(`/bucket/${bucket._id}/data/${document._id}`, document);
      expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
    });

    it("should not update document when updated one does not have unique value", async () => {
      const document = {
        title: "Fish And Companions",
        description: "Description of book"
      };

      let document2 = {
        _id: undefined,
        title: "Mice And Enemies",
        description: "Description of book"
      };

      await req.post(`/bucket/${bucket._id}/data`, document);
      document2 = await req.post(`/bucket/${bucket._id}/data`, document2).then(r => r.body);

      document2.title = "Fish And Companions";

      const response = await req
        .put(`/bucket/${bucket._id}/data/${document2._id}`, document2)
        .catch(e => e);

      expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
      expect(response.body.message).toEqual(
        "Value of the property .title should unique across all documents."
      );
    });

    it("should not insert documents when they do not have unique values", async () => {
      const document = {
        title: "Mice And Enemies",
        description: "Description of book"
      };

      await req.post(`/bucket/${bucket._id}/data`, document);

      const response = await req.post(`/bucket/${bucket._id}/data`, document).catch(e => e);

      expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
      expect(response.body.message).toEqual(
        "Value of the property .title should unique across all documents."
      );
    });
  });
});
