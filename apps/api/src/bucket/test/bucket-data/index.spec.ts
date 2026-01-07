import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket";
import {SchemaModule} from "@spica-server/core/schema";
import {CREATED_AT, UPDATED_AT} from "@spica-server/core/schema/defaults";
import {DATE_TIME, OBJECTID_STRING, OBJECT_ID} from "@spica-server/core/schema/formats";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {Bucket, BucketDocument} from "@spica-server/interface/bucket";

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
        DatabaseTestingModule.standalone(),
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
});
