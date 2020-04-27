import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket";
import {Bucket, BucketDocument} from "@spica-server/bucket/services";
import {Middlewares} from "@spica-server/core";
import {SchemaModule} from "@spica-server/core/schema";
import {CREATED_AT, DATE_TIME, OBJECT_ID, UPDATED_AT} from "@spica-server/core/schema/defaults";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {ObjectId} from "@spica-server/database";
import {DatabaseService, DatabaseTestingModule} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {BucketDataController} from "./bucket-data.controller";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 120000;

describe("BucketDataController", () => {
  let app: INestApplication;
  let req: Request;
  let module: TestingModule;
  let db: DatabaseService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        SchemaModule.forRoot({
          formats: [OBJECT_ID, DATE_TIME],
          defaults: [CREATED_AT, UPDATED_AT]
        }),
        CoreTestingModule,
        PassportTestingModule.initialize(),
        DatabaseTestingModule.replicaSet(),
        BucketModule.forRoot({hooks: false, history: false, realtime: false})
      ]
    }).compile();
    db = module.get(DatabaseService);
    app = module.createNestApplication();

    app.use(Middlewares.BsonBodyParser);
    req = module.get(Request);
    req.reject = true; /* Reject for non 2xx response codes */
    await app.listen(req.socket);

    jasmine.addCustomEqualityTester((actual, expected) => {
      if (expected == "__skip__" && typeof actual == typeof expected) {
        return true;
      }
    });
  });

  afterAll(async () => await app.close());

  describe("index", () => {
    let bucket = {
      _id: "",
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

    beforeAll(async () => {
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
        {_id: "__skip__", name: "Jim", age: 20},
        {_id: "__skip__", name: "Michael", age: 22},
        {_id: "__skip__", name: "Kevin", age: 25},
        {_id: "__skip__", name: "Dwight", age: 38},
        {_id: "__skip__", name: "Toby", age: 30}
      ]);
    });

    describe("skip and limit", () => {
      it("should work without query", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {});
        expect(documents.length).toEqual(5);

        expect(documents).toEqual([
          {_id: "__skip__", name: "Jim", age: 20},
          {_id: "__skip__", name: "Michael", age: 22},
          {_id: "__skip__", name: "Kevin", age: 25},
          {_id: "__skip__", name: "Dwight", age: 38},
          {_id: "__skip__", name: "Toby", age: 30}
        ]);
      });

      it("should work with limit query", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {limit: "3"});
        expect(documents.length).toEqual(3);
        expect(documents).toEqual([
          {_id: "__skip__", name: "Jim", age: 20},
          {_id: "__skip__", name: "Michael", age: 22},
          {_id: "__skip__", name: "Kevin", age: 25}
        ]);
      });

      it("should work with skip query", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {skip: "2"});
        expect(documents.length).toEqual(3);
        expect(documents).toEqual([
          {_id: "__skip__", name: "Kevin", age: 25},
          {_id: "__skip__", name: "Dwight", age: 38},
          {_id: "__skip__", name: "Toby", age: 30}
        ]);
      });

      it("should work with skip and limit query", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {
          limit: "2",
          skip: "1"
        });
        expect(documents.length).toEqual(2);
        expect(documents).toEqual([
          {_id: "__skip__", name: "Michael", age: 22},
          {_id: "__skip__", name: "Kevin", age: 25}
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
          {_id: "__skip__", name: "Dwight", age: 38},
          {_id: "__skip__", name: "Jim", age: 20},
          {_id: "__skip__", name: "Kevin", age: 25},
          {_id: "__skip__", name: "Michael", age: 22},
          {_id: "__skip__", name: "Toby", age: 30}
        ]);
      });

      it("descend by name", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {
          sort: JSON.stringify({name: -1})
        });

        expect(documents.length).toBe(5);

        expect(documents).toEqual([
          {_id: "__skip__", name: "Toby", age: 30},
          {_id: "__skip__", name: "Michael", age: 22},
          {_id: "__skip__", name: "Kevin", age: 25},
          {_id: "__skip__", name: "Jim", age: 20},
          {_id: "__skip__", name: "Dwight", age: 38}
        ]);
      });

      it("ascend by age", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {
          sort: JSON.stringify({age: 1})
        });

        expect(documents.length).toBe(5);
        expect(documents).toEqual([
          {_id: "__skip__", name: "Jim", age: 20},
          {_id: "__skip__", name: "Michael", age: 22},
          {_id: "__skip__", name: "Kevin", age: 25},
          {_id: "__skip__", name: "Toby", age: 30},
          {_id: "__skip__", name: "Dwight", age: 38}
        ]);
      });

      it("descend by age", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {
          sort: JSON.stringify({age: -1})
        });

        expect(documents.length).toBe(5);
        expect(documents).toEqual([
          {_id: "__skip__", name: "Dwight", age: 38},
          {_id: "__skip__", name: "Toby", age: 30},
          {_id: "__skip__", name: "Kevin", age: 25},
          {_id: "__skip__", name: "Michael", age: 22},
          {_id: "__skip__", name: "Jim", age: 20}
        ]);
      });
    });

    describe("pagination", () => {
      it("should paginate the results", async () => {
        const {body: response} = await req.get(`/bucket/${bucket._id}/data`, {paginate: "true"});
        expect(response.meta.total).toBe(5);
        expect(response.data.length).toBe(5);

        expect(response.data).toEqual([
          {_id: "__skip__", name: "Jim", age: 20},
          {_id: "__skip__", name: "Michael", age: 22},
          {_id: "__skip__", name: "Kevin", age: 25},
          {_id: "__skip__", name: "Dwight", age: 38},
          {_id: "__skip__", name: "Toby", age: 30}
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
          {_id: "__skip__", name: "Jim", age: 20},
          {_id: "__skip__", name: "Michael", age: 22}
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
          {_id: "__skip__", name: "Dwight", age: 38},
          {_id: "__skip__", name: "Toby", age: 30}
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
          {_id: "__skip__", name: "Kevin", age: 25},
          {_id: "__skip__", name: "Dwight", age: 38},
          {_id: "__skip__", name: "Toby", age: 30}
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
          {_id: "__skip__", name: "Jim", age: 20},
          {_id: "__skip__", name: "Michael", age: 22},
          {_id: "__skip__", name: "Kevin", age: 25},
          {_id: "__skip__", name: "Dwight", age: 38}
        ]);
      });

      it("should return the persons whose name is Jim", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {
          filter: JSON.stringify({name: "Jim"})
        });

        expect(documents.length).toBe(1);
        expect(documents).toEqual([{_id: "__skip__", name: "Jim", age: 20}]);
      });

      it("should return the persons whose age is 38", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {
          filter: JSON.stringify({age: 38})
        });

        expect(documents.length).toBe(1);
        expect(documents).toEqual([{_id: "__skip__", name: "Dwight", age: 38}]);
      });

      it("should return the persons who is older than 22", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {
          filter: JSON.stringify({age: {$gt: 22}})
        });

        expect(documents.length).toBe(3);
        expect(documents).toEqual([
          {_id: "__skip__", name: "Kevin", age: 25},
          {_id: "__skip__", name: "Dwight", age: 38},
          {_id: "__skip__", name: "Toby", age: 30}
        ]);
      });

      it("should return the persons who is younger than 25", async () => {
        const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, {
          filter: JSON.stringify({age: {$lt: 25}})
        });

        expect(documents.length).toBe(2);
        expect(documents).toEqual([
          {_id: "__skip__", name: "Jim", age: 20},
          {_id: "__skip__", name: "Michael", age: 22}
        ]);
      });

      describe("advanced filter", () => {
        let rows;
        beforeAll(async () => {
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
                $gte: `Date(${new Date("2020-04-20T10:00:00.000Z").toISOString()})`,
                $lt: `Date(${new Date("2020-05-20T10:00:00.000Z").toISOString()})`
              }
            })
          });

          expect(documents).toEqual([
            {_id: "__skip__", name: "Sherlock", age: 28, created_at: "2020-04-20T10:00:00.000Z"}
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
            {_id: "__skip__", name: "Doctor Who", age: 25, created_at: "2020-05-20T10:00:00.000Z"}
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

        afterAll(async () => {
          for (const row of rows) {
            await req.delete(`/bucket/${bucket._id}/data/${row._id}`);
          }
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
                options: {position: "left", translate: true, visible: true}
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
            {_id: "__skip__", title: "english words", description: "description"},
            {_id: "__skip__", title: "new english words", description: "description"},
            {_id: "__skip__", title: "only english words", description: "description"}
          ]);
        });

        it("should return turkish titles and fallback to default language", async () => {
          const {body: documents} = await req.get(`/bucket/${bucket._id}/data`, undefined, {
            "accept-language": "tr_TR"
          });

          expect(documents).toEqual([
            {_id: "__skip__", title: "türkçe kelimeler", description: "description"},
            {_id: "__skip__", title: "yeni türkçe kelimeler", description: "description"},
            {_id: "__skip__", title: "only english words", description: "description"}
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
              _id: "__skip__",
              title: {en_US: "english words", tr_TR: "türkçe kelimeler"},
              description: "description"
            },
            {
              _id: "__skip__",
              title: {en_US: "new english words", tr_TR: "yeni türkçe kelimeler"},
              description: "description"
            },
            {
              _id: "__skip__",
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
            {_id: "__skip__", title: "english words", description: "description"},
            {_id: "__skip__", title: "new english words", description: "description"},
            {_id: "__skip__", title: "only english words", description: "description"}
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
            _id: "__skip__",
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
            _id: "__skip__",
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
            _id: "__skip__",
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
            _id: "__skip__",
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

      let user: BucketDocument;
      let anotherUser: BucketDocument;
      let achievement: BucketDocument;

      beforeEach(async () => {
        achievementsBucket = await req
          .post("/bucket", {
            title: "Achievement",
            description: "Achievement",
            properties: {
              name: {
                type: "string",
                title: "achievement",
                description: "Title of the row",
                options: {position: "left"}
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
                type: "string",
                title: "username",
                description: "Title of the row",
                options: {position: "left"}
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
                options: {position: "left", visible: true},
                bucketId: achievementsBucket._id
              },
              user: {
                type: "relation",
                options: {position: "right"},
                bucketId: usersBucket._id
              }
            }
          })
          .then(r => r.body);

        user = await req
          .post(`/bucket/${usersBucket._id}/data`, {
            name: "user66"
          })
          .then(r => r.body);

        anotherUser = await req
          .post(`/bucket/${usersBucket._id}/data`, {
            name: "user33"
          })
          .then(r => r.body);

        achievement = await req
          .post(`/bucket/${achievementsBucket._id}/data`, {
            name: "do something until something else happens"
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
      });

      afterEach(async () => {
        const db = app.get(DatabaseService);

        await db.collection("buckets").deleteMany({
          _id: {$in: [statisticsBucket._id, usersBucket._id, achievementsBucket._id]}
        });
        // TODO: This should be handled by bucket controller
        await db.collection(`bucket_${statisticsBucket._id}`).drop();
        await db.collection(`bucket_${usersBucket._id}`).drop();
        await db.collection(`bucket_${achievementsBucket._id}`).drop();
      });

      it("should get statics with username and achievement name", async () => {
        const {body: documents} = await req.get(`/bucket/${statisticsBucket._id}/data`, {
          relation: true
        });
        expect(documents).toEqual([
          {
            _id: "__skip__",
            user: {
              _id: "__skip__",
              name: "user66"
            },
            achievement: {
              _id: "__skip__",
              name: "do something until something else happens"
            }
          },
          {
            _id: "__skip__",
            user: {
              _id: "__skip__",
              name: "user33"
            },
            achievement: {
              _id: "__skip__",
              name: "do something until something else happens"
            }
          }
        ]);
      });

      it("should get statics with only id", async () => {
        const {body: documents} = await req.get(`/bucket/${statisticsBucket._id}/data`, {
          relation: false
        });

        expect(documents).toEqual([
          {
            _id: "__skip__",
            user: user._id,
            achievement: achievement._id
          },
          {
            _id: "__skip__",
            user: anotherUser._id,
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
            _id: "__skip__",
            user: {
              _id: "__skip__",
              name: "user66"
            },
            achievement: {
              _id: "__skip__",
              name: "do something until something else happens"
            }
          },
          {
            _id: "__skip__",
            user: {
              _id: "__skip__",
              name: "user33"
            },
            achievement: {
              _id: "__skip__",
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
            _id: "__skip__",
            user: {
              _id: "__skip__",
              name: "user33"
            },
            achievement: {
              _id: "__skip__",
              name: "do something until something else happens"
            }
          }
        ]);
      });
    });
  });

  describe("post requests", () => {
    let myBucketId: ObjectId;
    beforeAll(async () => {
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
            options: {position: "left", visible: true}
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
    });

    afterEach(async () => {
      await app
        .get(DatabaseService)
        .collection(`bucket_${myBucketId}`)
        .deleteMany({})
        .catch();
    });

    afterAll(async () => {
      await app
        .get(DatabaseService)
        .collection("buckets")
        .deleteOne({_id: myBucketId})
        .catch();
    });

    it("should add document to bucket and return inserted document", async () => {
      const insertedDocument = (await req.post(`/bucket/${myBucketId}/data`, {
        title: "first title",
        description: "first description"
      })).body;

      const bucketDocument = (await req.get(
        `/bucket/${myBucketId}/data/${insertedDocument._id}`,
        {}
      )).body;

      expect(bucketDocument).toEqual(insertedDocument);

      delete insertedDocument._id;
      expect(insertedDocument).toEqual({title: "first title", description: "first description"});
    });

    it("should update document", async () => {
      const insertedDocument = (await req.post(`/bucket/${myBucketId}/data`, {
        title: "first title",
        description: "first description"
      })).body;

      const updatedDocument = (await req.put(`/bucket/${myBucketId}/data/${insertedDocument._id}`, {
        ...insertedDocument,
        title: "updated title"
      })).body;

      const bucketDocument = (await req.get(
        `/bucket/${myBucketId}/data/${updatedDocument._id}`,
        {}
      )).body;

      expect(bucketDocument).toEqual(updatedDocument);

      delete updatedDocument._id;
      expect(updatedDocument).toEqual({title: "updated title", description: "first description"});
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
        error: ".title should be string",
        message: "validation failed"
      });
    });

    // Flaky: This test fails with a clean run. Probably schema invalidator has a race condition with this it block.
    // Failures:
    // 1) Bucket-Data acceptance post requests should return error if description isnt valid for bucket
    //   Message:
    // [31m    Expected $[0] = 201 to equal 400.
    //     Expected $[1] = 'Created' to equal 'Bad Request'.[0m
    //   Stack:
    //     Error: Expected $[0] = 201 to equal 400.
    //     Expected $[1] = 'Created' to equal 'Bad Request'.
    //         at <Jasmine>
    //         at UserContext.<anonymous> (stacks/api/bucket/bucket-data.controller.spec.ts:945:58)
    //         at <Jasmine>
    //         at processTicksAndRejections (internal/process/task_queues.js:93:5)
    //   Message:
    // [31m    Expected $[0] = undefined to equal '.description should be string'.
    //     Expected $[1] = undefined to equal 'validation failed'.[0m
    //   Stack:
    //     Error: Expected $[0] = undefined to equal '.description should be string'.
    //     Expected $[1] = undefined to equal 'validation failed'.
    //         at <Jasmine>
    //         at UserContext.<anonymous> (stacks/api/bucket/bucket-data.controller.spec.ts:946:60)
    //         at <Jasmine>
    //         at processTicksAndRejections (internal/process/task_queues.js:93:5)
    xit("should return error if description isnt valid for bucket", async () => {
      const response = await req.post(`/bucket/${myBucketId}/data`, {
        title: "title",
        description: [1, 2, 3]
      });
      expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
      expect([response.body.error, response.body.message]).toEqual([
        ".description should be string",
        "validation failed"
      ]);
    });
  });

  describe("delete requests", () => {
    let myBucketId: ObjectId;
    let myBucketData;

    beforeAll(async () => {
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
            options: {position: "left", visible: true}
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
    });

    beforeEach(async () => {
      myBucketData = [
        {title: "first title", description: "first description"},
        {title: "last title", description: "last description"}
      ];
      //clear bucket-data
      await app
        .get(DatabaseService)
        .collection(`bucket_${myBucketId}`)
        .deleteMany({})
        .catch();

      //add data
      myBucketData[0]._id = new ObjectId(
        (await req.post(`/bucket/${myBucketId}/data`, myBucketData[0])).body._id
      );
      myBucketData[1]._id = new ObjectId(
        (await req.post(`/bucket/${myBucketId}/data`, myBucketData[1])).body._id
      );
    });

    afterAll(async () => {
      await app
        .get(DatabaseService)
        .collection(`bucket_${myBucketId}`)
        .deleteMany({})
        .catch();
      await app
        .get(DatabaseService)
        .collection("buckets")
        .deleteOne({_id: myBucketId})
        .catch();
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

    it("should delete multiple document", async () => {
      const response = await req.delete(`/bucket/${myBucketId}/data`, [
        myBucketData[0]._id.toHexString(),
        myBucketData[1]._id.toHexString()
      ]);

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe(undefined);

      const bucketData = (await req.get(`/bucket/${myBucketId}/data`, {})).body;

      expect(bucketData).toEqual([]);
    });
  });

  describe("clear relations", () => {
    let relationBucketId: ObjectId;
    let usersBucketId: ObjectId;
    let otherBucketId: ObjectId;

    let documentOneId: ObjectId;
    let documentTwoId: ObjectId;

    let userOneId: ObjectId;
    let userTwoId: ObjectId;
    let otherBucketDocumentId: ObjectId;

    beforeAll(async () => {
      usersBucketId = await req
        .post("/bucket", {
          title: "New Bucket",
          description: "Describe your new bucket",
          icon: "view_stream",
          primary: "title",
          readOnly: false,
          properties: {
            name: {
              type: "string",
              title: "name",
              description: "Title of the name",
              options: {position: "left"}
            }
          }
        })
        .then(r => new ObjectId(r.body._id));

      otherBucketId = await req
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
              description: "Title of the title",
              options: {position: "left"}
            }
          }
        })
        .then(r => new ObjectId(r.body._id));

      relationBucketId = await req
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
              options: {position: "left", visible: true}
            },
            nested_relation: {
              type: "object",
              options: {position: "left", visible: true},
              properties: {
                user_relation: {
                  type: "relation",
                  bucketId: usersBucketId
                },
                other_relation: {
                  type: "relation",
                  bucketId: otherBucketId
                }
              }
            }
          }
        })
        .then(r => new ObjectId(r.body._id));
    });

    beforeEach(async () => {
      userOneId = await req
        .post(`/bucket/${usersBucketId}/data`, {
          name: "user_one"
        })
        .then(r => new ObjectId(r.body._id));

      userTwoId = await req
        .post(`/bucket/${usersBucketId}/data`, {
          name: "user_two"
        })
        .then(r => new ObjectId(r.body._id));

      otherBucketDocumentId = await req
        .post(`/bucket/${otherBucketId}/data`, {
          title: "test_title"
        })
        .then(r => new ObjectId(r.body._id));

      documentOneId = await req
        .post(`/bucket/${relationBucketId}/data`, {
          title: "document_one",
          nested_relation: {
            user_relation: userOneId,
            other_relation: otherBucketDocumentId
          }
        })
        .then(r => new ObjectId(r.body._id));

      documentTwoId = await req
        .post(`/bucket/${relationBucketId}/data`, {
          title: "document_two",
          nested_relation: {
            user_relation: userTwoId,
            other_relation: otherBucketDocumentId
          }
        })
        .then(r => new ObjectId(r.body._id));
    });

    afterEach(async () => {
      await req.delete(`/bucket/${usersBucketId}/data`, [userOneId, userTwoId]);
      await req.delete(`/bucket/${relationBucketId}/data`, [documentOneId, documentTwoId]);
      await req.delete(`/bucket/${otherBucketId}/data/${otherBucketDocumentId}`);
    });

    it("should clear relations of documentOne when userOne deleted", async () => {
      let response = await req.delete(`/bucket/${usersBucketId}/data/${userOneId}`);
      expect(response.statusCode).toEqual(204);
      expect(response.body).toEqual(undefined);

      let {body: relationDocuments} = await req.get(`/bucket/${relationBucketId}/data`, {});
      expect(relationDocuments).toEqual([
        {
          _id: "__skip__",
          title: "document_one",
          nested_relation: {
            other_relation: otherBucketDocumentId.toHexString()
          }
        },
        {
          _id: "__skip__",
          title: "document_two",
          nested_relation: {
            user_relation: userTwoId.toHexString(),
            other_relation: otherBucketDocumentId.toHexString()
          }
        }
      ]);
    });

    it("should clear relations for both documents when userOne and userTwo deleted", async () => {
      let response = await req.delete(`/bucket/${usersBucketId}/data`, [userOneId, userTwoId]);
      expect(response.statusCode).toEqual(204);
      expect(response.body).toEqual(undefined);

      let {body: relationDocuments} = await req.get(`/bucket/${relationBucketId}/data`, {});
      expect(relationDocuments).toEqual([
        {
          _id: "__skip__",
          title: "document_one",
          nested_relation: {
            other_relation: otherBucketDocumentId.toHexString()
          }
        },
        {
          _id: "__skip__",
          title: "document_two",
          nested_relation: {
            other_relation: otherBucketDocumentId.toHexString()
          }
        }
      ]);
    });
  });
});
