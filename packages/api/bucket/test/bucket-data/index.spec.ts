import {contractSuite} from "@spica-server/database-testing";
import {Request} from "@spica-server/core-testing";
import {Bucket, BucketDocument} from "@spica-server/interface-bucket";
import {BucketApp, startBucketApp, withoutBlanks} from "../support/bucket-app";

contractSuite("BucketDataController", engine => {
  let api: BucketApp;
  let req: Request;
  let key: "_id" | "id";

  beforeEach(async () => {
    api = await startBucketApp(engine, {}, {omitNulls: true});
    req = api.req;
    key = api.keyField;
  });

  afterEach(() => api.close());

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
          options: {},
          maxLength: 20,
          minLength: 3
        },
        age: {
          type: "number",
          title: "Age of the person",
          options: {}
        },
        created_at: {
          type: "date",
          title: "Creation Timestamp",
          options: {}
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
        {[key]: rows[0][key], name: "Jim", age: 20},
        {[key]: rows[1][key], name: "Michael", age: 22},
        {[key]: rows[2][key], name: "Kevin", age: 25},
        {[key]: rows[3][key], name: "Dwight", age: 38},
        {[key]: rows[4][key], name: "Toby", age: 30}
      ]);
    });

    describe("skip and limit", () => {
      it("should work without query", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {});
        expect(documents.length).toEqual(5);

        expect(documents).toEqual([
          {[key]: documents[0][key], name: "Jim", age: 20},
          {[key]: documents[1][key], name: "Michael", age: 22},
          {[key]: documents[2][key], name: "Kevin", age: 25},
          {[key]: documents[3][key], name: "Dwight", age: 38},
          {[key]: documents[4][key], name: "Toby", age: 30}
        ]);
      });

      it("should work with limit query", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {limit: "3"});
        expect(documents.length).toEqual(3);
        expect(documents).toEqual([
          {[key]: documents[0][key], name: "Jim", age: 20},
          {[key]: documents[1][key], name: "Michael", age: 22},
          {[key]: documents[2][key], name: "Kevin", age: 25}
        ]);
      });

      it("should work with skip query", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {skip: "2"});
        expect(documents.length).toEqual(3);
        expect(documents).toEqual([
          {[key]: documents[0][key], name: "Kevin", age: 25},
          {[key]: documents[1][key], name: "Dwight", age: 38},
          {[key]: documents[2][key], name: "Toby", age: 30}
        ]);
      });

      it("should work with skip and limit query", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {
          limit: "2",
          skip: "1"
        });
        expect(documents.length).toEqual(2);
        expect(documents).toEqual([
          {[key]: documents[0][key], name: "Michael", age: 22},
          {[key]: documents[1][key], name: "Kevin", age: 25}
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
          {[key]: documents[0][key], name: "Dwight", age: 38},
          {[key]: documents[1][key], name: "Jim", age: 20},
          {[key]: documents[2][key], name: "Kevin", age: 25},
          {[key]: documents[3][key], name: "Michael", age: 22},
          {[key]: documents[4][key], name: "Toby", age: 30}
        ]);
      });

      it("descend by name", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {
          sort: JSON.stringify({name: -1})
        });

        expect(documents.length).toBe(5);

        expect(documents).toEqual([
          {[key]: documents[0][key], name: "Toby", age: 30},
          {[key]: documents[1][key], name: "Michael", age: 22},
          {[key]: documents[2][key], name: "Kevin", age: 25},
          {[key]: documents[3][key], name: "Jim", age: 20},
          {[key]: documents[4][key], name: "Dwight", age: 38}
        ]);
      });

      it("ascend by age", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {
          sort: JSON.stringify({age: 1})
        });

        expect(documents.length).toBe(5);
        expect(documents).toEqual([
          {[key]: documents[0][key], name: "Jim", age: 20},
          {[key]: documents[1][key], name: "Michael", age: 22},
          {[key]: documents[2][key], name: "Kevin", age: 25},
          {[key]: documents[3][key], name: "Toby", age: 30},
          {[key]: documents[4][key], name: "Dwight", age: 38}
        ]);
      });

      it("descend by age", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {
          sort: JSON.stringify({age: -1})
        });

        expect(documents.length).toBe(5);
        expect(documents).toEqual([
          {[key]: documents[0][key], name: "Dwight", age: 38},
          {[key]: documents[1][key], name: "Toby", age: 30},
          {[key]: documents[2][key], name: "Kevin", age: 25},
          {[key]: documents[3][key], name: "Michael", age: 22},
          {[key]: documents[4][key], name: "Jim", age: 20}
        ]);
      });
    });

    describe("pagination", () => {
      it("should paginate the results", async () => {
        const {body: response} = await req.get(`/bucket/${bucket._id}/data`, {paginate: "true"});
        expect(response.meta.total).toBe(5);
        expect(response.data.length).toBe(5);

        expect(response.data).toEqual([
          {[key]: response.data[0][key], name: "Jim", age: 20},
          {[key]: response.data[1][key], name: "Michael", age: 22},
          {[key]: response.data[2][key], name: "Kevin", age: 25},
          {[key]: response.data[3][key], name: "Dwight", age: 38},
          {[key]: response.data[4][key], name: "Toby", age: 30}
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
          {[key]: response.data[0][key], name: "Jim", age: 20},
          {[key]: response.data[1][key], name: "Michael", age: 22}
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
          {[key]: response.data[0][key], name: "Dwight", age: 38},
          {[key]: response.data[1][key], name: "Toby", age: 30}
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
          {[key]: response.data[0][key], name: "Kevin", age: 25},
          {[key]: response.data[1][key], name: "Dwight", age: 38},
          {[key]: response.data[2][key], name: "Toby", age: 30}
        ]);
      });

      it("should report the real total when the skip goes past the end", async () => {
        const {body: response} = await req.get(`/bucket/${bucket._id}/data`, {
          skip: "100",
          paginate: "true"
        });

        expect(response.meta.total).toBe(5);
        expect(response.data).toEqual([]);
      });

      it("should report the real total when a filtered page goes past the end", async () => {
        const {body: response} = await req.get(`/bucket/${bucket._id}/data`, {
          filter: api.filter({age: {$gt: 21}}, "age > 21"),
          skip: "100",
          paginate: "true"
        });

        expect(response.meta.total).toBe(4);
        expect(response.data).toEqual([]);
      });

      it("should report a zero total when nothing matches the filter", async () => {
        const {body: response} = await req.get(`/bucket/${bucket._id}/data`, {
          filter: api.filter({name: "Nobody"}, 'name == "Nobody"'),
          paginate: "true"
        });

        expect(response.meta.total).toBe(0);
        expect(response.data).toEqual([]);
      });
    });

    describe("filter", () => {
      it("should return the persons who has 'i' in their names", async () => {
        const {body: response} = await req.get(`/bucket/${bucket._id}/data`, {
          filter: api.filter({name: {$regex: "i"}}, 'regex(document.name, "i")')
        });

        expect(response.length).toBe(4);
        expect(response).toEqual([
          {[key]: response[0][key], name: "Jim", age: 20},
          {[key]: response[1][key], name: "Michael", age: 22},
          {[key]: response[2][key], name: "Kevin", age: 25},
          {[key]: response[3][key], name: "Dwight", age: 38}
        ]);
      });

      it("should return the persons whose name is Jim", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {
          filter: api.filter({name: "Jim"}, 'name == "Jim"')
        });

        expect(documents.length).toBe(1);
        expect(documents).toEqual([{[key]: documents[0][key], name: "Jim", age: 20}]);
      });

      it("should return the persons whose name is Jim (Expression)", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {
          filter: `name == "Jim"`
        });

        expect(documents.length).toBe(1);
        expect(documents).toEqual([{[key]: documents[0][key], name: "Jim", age: 20}]);
      });

      it("should return the persons whose age is 38", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {
          filter: api.filter({age: 38}, "age == 38")
        });

        expect(documents.length).toBe(1);
        expect(documents).toEqual([{[key]: documents[0][key], name: "Dwight", age: 38}]);
      });

      it("should return the persons whose age is 38 (Expression)", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {
          filter: `age == 38`
        });

        expect(documents.length).toBe(1);
        expect(documents).toEqual([{[key]: documents[0][key], name: "Dwight", age: 38}]);
      });

      it("should return the persons who is older than 22", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {
          filter: api.filter({age: {$gt: 22}}, "age > 22")
        });

        expect(documents.length).toBe(3);
        expect(documents).toEqual([
          {[key]: documents[0][key], name: "Kevin", age: 25},
          {[key]: documents[1][key], name: "Dwight", age: 38},
          {[key]: documents[2][key], name: "Toby", age: 30}
        ]);
      });

      it("should return the persons who is older than 22 (Expression)", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {
          filter: `age > 22`
        });

        expect(documents.length).toBe(3);
        expect(documents).toEqual([
          {[key]: documents[0][key], name: "Kevin", age: 25},
          {[key]: documents[1][key], name: "Dwight", age: 38},
          {[key]: documents[2][key], name: "Toby", age: 30}
        ]);
      });

      it("should return the persons who is younger than 25", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {
          filter: api.filter({age: {$lt: 25}}, "age < 25")
        });

        expect(documents.length).toBe(2);
        expect(documents).toEqual([
          {[key]: documents[0][key], name: "Jim", age: 20},
          {[key]: documents[1][key], name: "Michael", age: 22}
        ]);
      });

      it("should return the persons who is younger than 25 (Expression)", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {
          filter: `age < 25`
        });

        expect(documents.length).toBe(2);
        expect(documents).toEqual([
          {[key]: documents[0][key], name: "Jim", age: 20},
          {[key]: documents[1][key], name: "Michael", age: 22}
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
            filter: api.filter(
              {
                created_at: {
                  $gte: `Date(2020-04-20T10:00:00.000Z)`,
                  $lt: `Date(2020-05-20T10:00:00.000Z)`
                }
              },
              'created_at >= "2020-04-20T10:00:00.000Z" && created_at < "2020-05-20T10:00:00.000Z"'
            )
          });

          expect(documents).toEqual([
            {
              [key]: documents[0][key],
              name: "Sherlock",
              age: 28,
              created_at: "2020-04-20T10:00:00.000Z"
            }
          ]);
        });

        it("should get documents whose creation date is the greatest", async () => {
          const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {
            filter: api.filter(
              {
                created_at: {
                  $gt: `Date(${new Date("2020-04-20T10:00:00.000Z").toISOString()})`
                }
              },
              'created_at > "2020-04-20T10:00:00.000Z"'
            )
          });

          expect(documents).toEqual([
            {
              [key]: documents[0][key],
              name: "Doctor Who",
              age: 25,
              created_at: "2020-05-20T10:00:00.000Z"
            }
          ]);
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
                options: {translate: true}
              },
              description: {
                type: "textarea",
                title: "description",
                description: "Description of the row",
                options: {}
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
            {[key]: documents[0][key], title: "english words", description: "description"},
            {[key]: documents[1][key], title: "new english words", description: "description"},
            {[key]: documents[2][key], title: "only english words", description: "description"}
          ]);
        });

        it("should return turkish titles and fallback to default language", async () => {
          const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, undefined, {
            "accept-language": "tr_TR"
          });

          expect(documents).toEqual([
            {[key]: documents[0][key], title: "türkçe kelimeler", description: "description"},
            {[key]: documents[1][key], title: "yeni türkçe kelimeler", description: "description"},
            {[key]: documents[2][key], title: "only english words", description: "description"}
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
              [key]: documents[0][key],
              title: {en_US: "english words", tr_TR: "türkçe kelimeler"},
              description: "description"
            },
            {
              [key]: documents[1][key],
              title: {en_US: "new english words", tr_TR: "yeni türkçe kelimeler"},
              description: "description"
            },
            {
              [key]: documents[2][key],
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
            {[key]: documents[0][key], title: "english words", description: "description"},
            {[key]: documents[1][key], title: "new english words", description: "description"},
            {[key]: documents[2][key], title: "only english words", description: "description"}
          ]);
        });
      });

      describe("findOne requests", () => {
        it("should return English title ", async () => {
          const {body: document} = await req.get(
            `/bucket/${bucket._id}/data/${rows[0][key]}`,
            undefined,
            {"accept-language": "en_US"}
          );
          expect(document).toEqual({
            [key]: document[key],
            title: "english words",
            description: "description"
          });
        });

        it("should return Turkish title ", async () => {
          const {body: document} = await req.get(
            `/bucket/${bucket._id}/data/${rows[0][key]}`,
            undefined,
            {"accept-language": "tr_TR"}
          );
          expect(document).toEqual({
            [key]: document[key],
            title: "türkçe kelimeler",
            description: "description"
          });
        });

        it("should return document as is when localize parameter is false", async () => {
          const {body: document} = await req.get(
            `/bucket/${bucket._id}/data/${rows[0][key]}`,
            {localize: "false"},
            {"accept-language": "tr_TR"}
          );
          expect(document).toEqual({
            [key]: document[key],
            title: {en_US: "english words", tr_TR: "türkçe kelimeler"},
            description: "description"
          });
        });

        it("should return fallback language's titles when the titles are not available in requested language", async () => {
          const {body: document} = await req.get(
            `/bucket/${bucket._id}/data/${rows[2][key]}`,
            undefined,
            {"accept-language": "tr_TR"}
          );
          expect(document).toEqual({
            [key]: document[key],
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
                options: {},
                bucketId: achievementsBucket._id,
                relationType: "onetoone"
              },
              user: {
                type: "relation",
                options: {},
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
            wallet: wallets.map(wallet => wallet[key])
          })
          .then(r => r.body);

        await req.post(`/bucket/${statisticsBucket._id}/data`, {
          user: user[key],
          achievement: achievement[key]
        });

        await req.post(`/bucket/${statisticsBucket._id}/data`, {
          user: anotherUser[key],
          achievement: achievement[key]
        });

        userWithWalletStats = await req
          .post(`/bucket/${statisticsBucket._id}/data`, {
            user: userWithWallet[key],
            achievement: achievement[key]
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
            {[key]: users[0][key], name: "user66", wallet: []},
            {[key]: users[1][key], name: "user33", wallet: []},
            {
              [key]: users[2][key],
              name: "wealthy user",
              wallet: [
                {[key]: users[2].wallet[0][key], name: "GNB"},
                {[key]: users[2].wallet[1][key], name: "FNB"}
              ]
            }
          ]);
        });

        it("should return users by their wallet name", async () => {
          const {body: users} = await req.get(`/bucket/${usersBucket._id}/data`, {
            relation: true,
            filter: api.filter({"wallet.name": "GNB"}, 'some(document.wallet.name, ["GNB"])')
          });
          expect(users).toEqual([
            {
              [key]: users[0][key],
              name: "wealthy user",
              wallet: [
                {[key]: users[0].wallet[0][key], name: "GNB"},
                {[key]: users[0].wallet[1][key], name: "FNB"}
              ]
            }
          ]);
        });

        it("should get statistics with username and achievement name", async () => {
          const {body: documents} = await req.get(`/bucket/${statisticsBucket._id}/data`, {
            relation: true
          });
          expect(withoutBlanks(documents)).toEqual([
            {
              [key]: documents[0][key],
              user: {
                [key]: documents[0].user[key],
                name: "user66"
              },
              achievement: {
                [key]: documents[0].achievement[key],
                name: "do something until something else happens"
              }
            },
            {
              [key]: documents[1][key],
              user: {
                [key]: documents[1].user[key],
                name: "user33"
              },
              achievement: {
                [key]: documents[1].achievement[key],
                name: "do something until something else happens"
              }
            },
            {
              [key]: documents[2][key],
              user: {
                [key]: documents[2].user[key],
                name: "wealthy user",
                wallet: wallets.map(w => w[key])
              },
              achievement: {
                [key]: documents[2].achievement[key],
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
              [key]: documents[0][key],
              user: {
                [key]: documents[0].user[key],
                name: "user66",
                wallet: []
              },
              achievement: {
                [key]: documents[0].achievement[key],
                name: "do something until something else happens"
              }
            },
            {
              [key]: documents[1][key],
              user: {
                [key]: documents[1].user[key],
                name: "user33",
                wallet: []
              },
              achievement: {
                [key]: documents[1].achievement[key],
                name: "do something until something else happens"
              }
            },
            {
              [key]: documents[2][key],
              user: {
                [key]: documents[2].user[key],
                name: "wealthy user",
                wallet: [
                  {[key]: documents[2].user.wallet[0][key], name: "GNB"},
                  {[key]: documents[2].user.wallet[1][key], name: "FNB"}
                ]
              },
              achievement: {
                [key]: documents[2].achievement[key],
                name: "do something until something else happens"
              }
            }
          ]);
        });

        it("should filter statistics by user wallet", async () => {
          const {body: documents} = await req.get(`/bucket/${statisticsBucket._id}/data`, {
            relation: ["user.wallet", "achievement"],
            filter: api.filter(
              {"user.wallet.name": "GNB"},
              'some(document.user.wallet.name, ["GNB"])'
            )
          });
          expect(documents).toEqual([
            {
              [key]: documents[0][key],
              user: {
                [key]: documents[0].user[key],
                name: "wealthy user",
                wallet: [
                  {[key]: documents[0].user.wallet[0][key], name: "GNB"},
                  {[key]: documents[0].user.wallet[1][key], name: "FNB"}
                ]
              },
              achievement: {
                [key]: documents[0].achievement[key],
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
              [key]: documents[0][key],
              user: user[key],
              achievement: achievement[key]
            },
            {
              [key]: documents[1][key],
              user: anotherUser[key],
              achievement: achievement[key]
            },
            {
              [key]: documents[2][key],
              user: userWithWallet[key],
              achievement: achievement[key]
            }
          ]);
        });

        it("should return the documents including those which does not have the relation field filled", async () => {
          const {body: newRow} = await req.post(`/bucket/${statisticsBucket._id}/data`, {});
          const {body: documents} = await req.get(`/bucket/${statisticsBucket._id}/data`, {
            relation: true
          });
          expect(withoutBlanks(documents)).toEqual([
            {
              [key]: documents[0][key],
              user: {
                [key]: documents[0].user[key],
                name: "user66"
              },
              achievement: {
                [key]: documents[0].achievement[key],
                name: "do something until something else happens"
              }
            },
            {
              [key]: documents[1][key],
              user: {
                [key]: documents[1].user[key],
                name: "user33"
              },
              achievement: {
                [key]: documents[1].achievement[key],
                name: "do something until something else happens"
              }
            },
            {
              [key]: documents[2][key],
              user: {
                [key]: documents[2].user[key],
                name: "wealthy user",
                wallet: wallets.map(w => w[key])
              },
              achievement: {
                [key]: documents[2].achievement[key],
                name: "do something until something else happens"
              }
            },
            {
              [key]: newRow[key]
            }
          ]);
        });

        it("should filter by relation", async () => {
          const {body: documents} = await req.get(`/bucket/${statisticsBucket._id}/data`, {
            relation: true,
            filter: api.filter(
              {"user._id": anotherUser[key]},
              `document.user.${key} == "${anotherUser[key]}"`
            )
          });

          expect(withoutBlanks(documents)).toEqual([
            {
              [key]: documents[0][key],
              user: {
                [key]: documents[0].user[key],
                name: "user33"
              },
              achievement: {
                [key]: documents[0].achievement[key],
                name: "do something until something else happens"
              }
            }
          ]);
        });

        it("should not resolve relation and apply the filter correctly", async () => {
          const {body: documents} = await req.get(`/bucket/${statisticsBucket._id}/data`, {
            filter: api.filter({user: anotherUser[key]}, `document.user == "${anotherUser[key]}"`)
          });

          expect(documents).toEqual([
            {
              [key]: documents[0][key],
              user: anotherUser[key],
              achievement: achievement[key]
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
                read: `document.user.${key}=='${user[key]}'`
              }
            });

            const filter = api.filter({user: user[key]}, `document.user == "${user[key]}"`);

            const {body: documents} = await req.get(`/bucket/${statisticsBucket._id}/data`, {
              filter
            });

            // resolve relation before apply rule, then apply rule
            // reset resolved relations that comes from rules
            // apply filter

            expect(documents).toEqual([
              {
                [key]: documents[0][key],
                user: user[key],
                achievement: achievement[key]
              }
            ]);
          });

          it("should run when filter is a child of requested relation", async () => {
            const filter = api.filter(
              {"user.name": "wealthy user"},
              'document.user.name == "wealthy user"'
            );
            const relation = ["user.wallet", "achievement"];

            const {body: documents} = await req.get(`/bucket/${statisticsBucket._id}/data`, {
              filter,
              relation
            });

            expect(documents).toEqual([
              {
                [key]: documents[0][key],
                user: {
                  [key]: documents[0].user[key],
                  name: "wealthy user",
                  wallet: [
                    {[key]: documents[0].user.wallet[0][key], name: "GNB"},
                    {[key]: documents[0].user.wallet[1][key], name: "FNB"}
                  ]
                },
                achievement: {
                  [key]: documents[0].achievement[key],
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
            `/bucket/${statisticsBucket._id}/data/${userWithWalletStats[key]}`,
            {
              relation: true
            }
          );
          expect(document).toEqual({
            [key]: document[key],
            user: {
              [key]: document.user[key],
              name: "wealthy user",
              wallet: wallets.map(w => w[key])
            },
            achievement: {
              [key]: document.achievement[key],
              name: "do something until something else happens"
            }
          });
        });

        it("should get statistic with username id and achievement id", async () => {
          const {body: document} = await req.get(
            `/bucket/${statisticsBucket._id}/data/${userWithWalletStats[key]}`,
            {
              relation: false
            }
          );
          expect(document).toEqual({
            [key]: document[key],
            user: userWithWallet[key],
            achievement: achievement[key]
          });
        });

        it("should get statistic with user and own wallet", async () => {
          const {body: document} = await req.get(
            `/bucket/${statisticsBucket._id}/data/${userWithWalletStats[key]}`,
            {
              relation: ["user.wallet"]
            }
          );
          expect(document).toEqual({
            [key]: document[key],
            user: {
              [key]: document.user[key],
              name: "wealthy user",
              wallet: [
                {[key]: document.user.wallet[0][key], name: "GNB"},
                {[key]: document.user.wallet[1][key], name: "FNB"}
              ]
            },
            achievement: achievement[key]
          });
        });
      });
    });
  });
});
