import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {ActivityModule} from "@spica-server/activity";
import {BucketModule} from "@spica-server/bucket";
import {SchemaModule} from "@spica/core";
import {CREATED_AT, UPDATED_AT} from "@spica/core";
import {DATE_TIME, OBJECTID_STRING, OBJECT_ID} from "@spica/core";
import {CoreTestingModule, Request} from "@spica/core";
import {DatabaseTestingModule, ObjectId, stream} from "@spica/database";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";

export function getBucketName(id: string | ObjectId) {
  return `Bucket_${id}`;
}

describe("GraphQLController", () => {
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
          graphql: true
        }),
        ActivityModule.forRoot({expireAfterSeconds: 10})
      ]
    }).compile();
    app = module.createNestApplication();

    req = module.get(Request);
    req.reject = true; /* Reject for non 2xx response codes */
    await app.listen(req.socket);

    jasmine.addCustomEqualityTester((actual, expected) => {
      if (expected == "__skip__" && typeof actual == typeof expected) {
        return true;
      }
    });
  });

  afterEach(() => app.close());

  describe("No Bucket", () => {
    it("should return default response when there is no bucket ", async () => {
      //remove existing buckets
      const {body: buckets} = await req.get("/bucket");
      if (buckets) {
        const deletes = buckets.map(bucket => req.delete(`/bucket/${bucket._id}`));
        await Promise.all(deletes);
      }

      //wait until watcher send changes
      await stream.change.next();

      const params = {
        query: "{spica}"
      };
      const {body} = await req.get("/graphql", params);

      expect(body).toEqual({data: {spica: "Spica"}});
    });
  });

  describe("With Buckets", () => {
    describe("Queries", () => {
      let bucketName;
      let bucket;
      let rows;
      beforeEach(async () => {
        bucket = await req
          .post("/bucket", {
            title: "Persons",
            description: "Person bucket",
            icon: "view_stream",
            primary: "title",
            properties: {
              name: {
                type: "string",
                title: "Name of the person",
                options: {position: "left"}
              },
              age: {
                type: "number",
                title: "Age of the person",
                options: {position: "right"}
              }
            }
          })
          .then(response => response.body);

        bucketName = getBucketName(bucket._id);

        rows = [
          await req.post(`/bucket/${bucket._id}/data`, {name: "Jim", age: 20}),
          await req.post(`/bucket/${bucket._id}/data`, {name: "Michael", age: 22}),
          await req.post(`/bucket/${bucket._id}/data`, {name: "Kevin", age: 25}),
          await req.post(`/bucket/${bucket._id}/data`, {name: "Dwight", age: 38}),
          await req.post(`/bucket/${bucket._id}/data`, {name: "Toby", age: 30})
        ].map(r => r.body);

        //wait until watcher send changes
        await stream.change.next();
      });

      it("should return document that matches with given id", async () => {
        const params = {
          query: `{
              FindBy${bucketName}Id(_id: "${rows[1]._id}"){
                _id
                name
                age
              }
            }`
        };

        const {body} = await req.get("/graphql", params);

        expect(body).toEqual({
          data: {
            [`FindBy${bucketName}Id`]: {_id: rows[1]._id, name: "Michael", age: 22}
          }
        });
      });

      it("should return documents", async () => {
        const params = {
          query: `{
              Find${bucketName}{
                meta{
                  total
                }
                data{
                  _id
                  name
                  age
                }
              }
            }`
        };

        const {body} = await req.get("/graphql", params);

        expect(body).toEqual({
          data: {
            [`Find${bucketName}`]: {
              meta: {total: 5},
              data: [
                {_id: rows[0]._id, name: "Jim", age: 20},
                {_id: rows[1]._id, name: "Michael", age: 22},
                {_id: rows[2]._id, name: "Kevin", age: 25},
                {_id: rows[3]._id, name: "Dwight", age: 38},
                {_id: rows[4]._id, name: "Toby", age: 30}
              ]
            }
          }
        });
      });

      it("should return documents with only specified fields", async () => {
        const params = {
          query: `{
              Find${bucketName}{
                meta{
                  total
                }
                data{
                  name
                }
              }
            }`
        };

        const {body} = await req.get("/graphql", params);

        expect(body).toEqual({
          data: {
            [`Find${bucketName}`]: {
              meta: {total: 5},
              data: [
                {name: "Jim"},
                {name: "Michael"},
                {name: "Kevin"},
                {name: "Dwight"},
                {name: "Toby"}
              ]
            }
          }
        });
      });

      describe("skip and limit", () => {
        it("should return documents with skip", async () => {
          const params = {
            query: `{
                Find${bucketName}(skip:1){
                  meta{
                    total
                  }
                  data{
                    _id
                    name
                    age
                  }
                }
              }`
          };

          const {body} = await req.get("/graphql", params);

          expect(body).toEqual({
            data: {
              [`Find${bucketName}`]: {
                meta: {total: 5},
                data: [
                  {_id: rows[1]._id, name: "Michael", age: 22},
                  {_id: rows[2]._id, name: "Kevin", age: 25},
                  {_id: rows[3]._id, name: "Dwight", age: 38},
                  {_id: rows[4]._id, name: "Toby", age: 30}
                ]
              }
            }
          });
        });

        it("should return documents with limit", async () => {
          const params = {
            query: `{
                Find${bucketName}(limit:1){
                  meta{
                    total
                  }
                  data{
                    _id
                    name
                    age
                  }
                }
              }`
          };

          const {body} = await req.get("/graphql", params);

          expect(body).toEqual({
            data: {
              [`Find${bucketName}`]: {
                meta: {total: 5},
                data: [{_id: rows[0]._id, name: "Jim", age: 20}]
              }
            }
          });
        });

        it("should return documents with skip and limit", async () => {
          const params = {
            query: `{
                Find${bucketName}(limit:1, skip:1){
                  meta{
                    total
                  }
                  data{
                    _id
                    name
                    age
                  }
                }
              }`
          };

          const {body} = await req.get("/graphql", params);

          expect(body).toEqual({
            data: {
              [`Find${bucketName}`]: {
                meta: {total: 5},
                data: [{_id: rows[1]._id, name: "Michael", age: 22}]
              }
            }
          });
        });
      });

      describe("sort", () => {
        it("should return documents sorted as ascend by id", async () => {
          const params = {
            query: `{
                Find${bucketName}(sort:{_id:1}){
                  meta{
                    total
                  }
                  data{
                    _id
                    name
                    age
                  }
                }
              }`
          };

          const {body} = await req.get("/graphql", params);

          expect(body).toEqual({
            data: {
              [`Find${bucketName}`]: {
                meta: {total: 5},
                data: [
                  {_id: rows[0]._id, name: "Jim", age: 20},
                  {_id: rows[1]._id, name: "Michael", age: 22},
                  {_id: rows[2]._id, name: "Kevin", age: 25},
                  {_id: rows[3]._id, name: "Dwight", age: 38},
                  {_id: rows[4]._id, name: "Toby", age: 30}
                ]
              }
            }
          });
        });
        it("should return documents sorted as descend by id", async () => {
          const params = {
            query: `{
              Find${bucketName}(sort:{_id:-1}){
                meta{
                  total
                }
                data{
                  _id
                  name
                  age
                }
              }
            }`
          };

          const {body} = await req.get("/graphql", params);

          expect(body).toEqual({
            data: {
              [`Find${bucketName}`]: {
                meta: {total: 5},
                data: [
                  {_id: rows[4]._id, name: "Toby", age: 30},
                  {_id: rows[3]._id, name: "Dwight", age: 38},
                  {_id: rows[2]._id, name: "Kevin", age: 25},
                  {_id: rows[1]._id, name: "Michael", age: 22},
                  {_id: rows[0]._id, name: "Jim", age: 20}
                ]
              }
            }
          });
        });

        it("should return documents sorted as ascend by name", async () => {
          const params = {
            query: `{
                Find${bucketName}(sort:{name:1}){
                  meta{
                    total
                  }
                  data{
                    _id
                    name
                    age
                  }
                }
              }`
          };

          const {body} = await req.get("/graphql", params);

          expect(body).toEqual({
            data: {
              [`Find${bucketName}`]: {
                meta: {total: 5},
                data: [
                  {_id: rows[3]._id, name: "Dwight", age: 38},
                  {_id: rows[0]._id, name: "Jim", age: 20},
                  {_id: rows[2]._id, name: "Kevin", age: 25},
                  {_id: rows[1]._id, name: "Michael", age: 22},
                  {_id: rows[4]._id, name: "Toby", age: 30}
                ]
              }
            }
          });
        });

        it("should return documents sorted as descend by name", async () => {
          const params = {
            query: `{
                Find${bucketName}(sort:{name:-1}){
                  meta{
                    total
                  }
                  data{
                    _id
                    name
                    age
                  }
                }
              }`
          };

          const {body} = await req.get("/graphql", params);

          expect(body).toEqual({
            data: {
              [`Find${bucketName}`]: {
                meta: {total: 5},
                data: [
                  {_id: rows[4]._id, name: "Toby", age: 30},
                  {_id: rows[1]._id, name: "Michael", age: 22},
                  {_id: rows[2]._id, name: "Kevin", age: 25},
                  {_id: rows[0]._id, name: "Jim", age: 20},
                  {_id: rows[3]._id, name: "Dwight", age: 38}
                ]
              }
            }
          });
        });
      });

      describe("filter", () => {
        it("should return documents which has name Kevin", async () => {
          const params = {
            query: `{
                Find${bucketName}(query: { name:Kevin }){
                  meta{
                    total
                  }
                  data{
                    _id
                    name
                    age
                  }
                }
              }`
          };

          const {body} = await req.get("/graphql", params);

          expect(body).toEqual({
            data: {
              [`Find${bucketName}`]: {
                meta: {total: 1},
                data: [{_id: rows[2]._id, name: "Kevin", age: 25}]
              }
            }
          });
        });

        it("should return documents which has name includes 'i' and has age greater than 23 or has name includes 'ich' and has age exactly 22  ", async () => {
          const params = {
            query: `{
                Find${bucketName}(query: 
                    {
                      OR: [
                        {
                          AND: [
                            {
                              name_regex: "i"
                            },
                            {
                              age_gt: 23
                            }
                          ]
                        },
                        {
                          AND: [
                            {
                              name_regex: "ich"
                            },
                            {
                              age_eq: 22
                            }
                          ]
                        }
                      ]
                    }
                  ){
                  meta{
                    total
                  }
                  data{
                    _id
                    name
                    age
                  }
                }
              }`
          };

          const {body} = await req.get("/graphql", params);

          expect(body).toEqual({
            data: {
              [`Find${bucketName}`]: {
                meta: {total: 3},
                data: [
                  {_id: rows[1]._id, name: "Michael", age: 22},
                  {_id: rows[2]._id, name: "Kevin", age: 25},
                  {_id: rows[3]._id, name: "Dwight", age: 38}
                ]
              }
            }
          });
        });
      });

      describe("localize", () => {
        let languageBucket;
        let languageBucketName;
        let languageRows;

        beforeEach(async () => {
          languageBucket = await req
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

          languageBucketName = getBucketName(languageBucket._id);

          languageRows = [
            await req.post(`/bucket/${languageBucket._id}/data`, {
              title: {en_US: "english words", tr_TR: "türkçe kelimeler"},
              description: "description"
            }),
            await req.post(`/bucket/${languageBucket._id}/data`, {
              title: {en_US: "new english words", tr_TR: "yeni türkçe kelimeler"},
              description: "description"
            }),
            await req.post(`/bucket/${languageBucket._id}/data`, {
              title: {en_US: "only english words"},
              description: "description"
            })
          ].map(r => r.body);

          //wait until watcher send changes
          await stream.change.next();
        });

        it("should return documents with english titles", async () => {
          const params = {
            query: `{
                Find${languageBucketName}(language: "EN"){
                  meta{
                    total
                  }
                  data{
                    _id
                    title
                    description
                  }
                }
              }`
          };

          const {body} = await req.get("/graphql", params);

          expect(body).toEqual({
            data: {
              [`Find${languageBucketName}`]: {
                meta: {total: 3},
                data: [
                  {
                    _id: languageRows[0]._id,
                    title: "english words",
                    description: "description"
                  },
                  {
                    _id: languageRows[1]._id,
                    title: "new english words",
                    description: "description"
                  },
                  {
                    _id: languageRows[2]._id,
                    title: "only english words",
                    description: "description"
                  }
                ]
              }
            }
          });
        });

        it("should return documents with turkish titles and fallback to default language", async () => {
          const params = {
            query: `{
                Find${languageBucketName}(language: "TR"){
                  meta{
                    total
                  }
                  data{
                    _id
                    title
                    description
                  }
                }
              }`
          };

          const {body} = await req.get("/graphql", params);

          expect(body).toEqual({
            data: {
              [`Find${languageBucketName}`]: {
                meta: {total: 3},
                data: [
                  {
                    _id: languageRows[0]._id,
                    title: "türkçe kelimeler",
                    description: "description"
                  },
                  {
                    _id: languageRows[1]._id,
                    title: "yeni türkçe kelimeler",
                    description: "description"
                  },
                  {
                    _id: languageRows[2]._id,
                    title: "only english words",
                    description: "description"
                  }
                ]
              }
            }
          });
        });

        it("should return documents with default language", async () => {
          const params = {
            query: `{
                Find${languageBucketName}{
                  meta{
                    total
                  }
                  data{
                    _id
                    title
                    description
                  }
                }
              }`
          };

          const {body} = await req.get("/graphql", params);

          expect(body).toEqual({
            data: {
              [`Find${languageBucketName}`]: {
                meta: {total: 3},
                data: [
                  {
                    _id: languageRows[0]._id,
                    title: "english words",
                    description: "description"
                  },
                  {
                    _id: languageRows[1]._id,
                    title: "new english words",
                    description: "description"
                  },
                  {
                    _id: languageRows[2]._id,
                    title: "only english words",
                    description: "description"
                  }
                ]
              }
            }
          });
        });

        it("should return document with turkish title that matches with given id", async () => {
          const params = {
            query: `{
                FindBy${languageBucketName}Id(_id: "${languageRows[1]._id}",language: "TR"){
                  _id
                  title
                  description
                }
              }`
          };

          const {body} = await req.get("/graphql", params);
          expect(body).toEqual({
            data: {
              [`FindBy${languageBucketName}Id`]: {
                _id: languageRows[1]._id,
                title: "yeni türkçe kelimeler",
                description: "description"
              }
            }
          });
        });
      });

      describe("relation", () => {
        const today = new Date("2020-10-19T12:00:00.000Z");
        const yesterday = new Date("2020-10-18T12:00:00.000Z");
        const tomorrow = new Date("2020-10-20T12:00:00.000Z");

        let authorsBucket;
        let authorsBucketName;

        let eventsBucket;
        let eventsBucketName;

        let booksBucket;
        let booksBucketName;

        let publishersBucket;
        let publishersBucketName;

        let authors;
        let events;
        let books;
        let publishers;

        beforeEach(async () => {
          booksBucket = {
            title: "Books",
            description: "Books",
            properties: {
              title: {
                type: "string"
              },
              publish_date: {
                type: "date"
              }
            }
          };
          booksBucket = await req.post("/bucket", booksBucket).then(r => r.body);
          booksBucketName = getBucketName(booksBucket._id);

          publishersBucket = {
            title: "Publisher",
            description: "Publisher",
            properties: {
              name: {
                type: "string"
              },
              books: {
                type: "relation",
                relationType: "onetomany",
                bucketId: booksBucket._id,
                dependent: true
              }
            }
          };
          publishersBucket = await req.post("/bucket", publishersBucket).then(r => r.body);
          publishersBucketName = getBucketName(publishersBucket._id);

          eventsBucket = {
            title: "Events",
            description: "Events",
            properties: {
              name: {
                type: "string"
              },
              year: {
                type: "number"
              }
            }
          };
          eventsBucket = await req.post("/bucket", eventsBucket).then(r => r.body);
          eventsBucketName = getBucketName(eventsBucket._id);

          authorsBucket = {
            title: "Authors",
            description: "Authors",
            properties: {
              fullname: {
                type: "string"
              },
              events: {
                type: "relation",
                relationType: "onetomany",
                bucketId: eventsBucket._id
              }
            }
          };
          authorsBucket = await req.post("/bucket", authorsBucket).then(r => r.body);
          authorsBucketName = getBucketName(authorsBucket._id);

          booksBucket.properties = {
            ...booksBucket.properties,
            publisher: {
              type: "relation",
              relationType: "onetoone",
              bucketId: publishersBucket._id
            },
            author: {
              type: "relation",
              relationType: "onetoone",
              bucketId: authorsBucket._id
            }
          };

          booksBucket = await req
            .put(`/bucket/${booksBucket._id}`, booksBucket)
            .then(response => response.body);

          //insert data

          events = [
            await req.post(`/bucket/${eventsBucket._id}/data`, {
              name: "Event Rebel",
              year: 2020
            }),
            await req.post(`/bucket/${eventsBucket._id}/data`, {
              name: "Seastar Fest",
              year: 2010
            })
          ].map(r => r.body);

          authors = [
            await req.post(`/bucket/${authorsBucket._id}/data`, {
              fullname: "Jaydon Villa",
              events: [events[0]._id, events[1]._id]
            }),
            await req.post(`/bucket/${authorsBucket._id}/data`, {
              fullname: "Juan Moody",
              events: [events[0]._id]
            })
          ].map(r => r.body);

          books = [
            await req.post(`/bucket/${booksBucket._id}/data`, {
              title: "Priest With Vigor",
              publish_date: today,
              author: authors[0]._id
            }),
            await req.post(`/bucket/${booksBucket._id}/data`, {
              title: "Goddess Of Earth",
              publish_date: yesterday,
              author: authors[0]._id
            }),
            await req.post(`/bucket/${booksBucket._id}/data`, {
              title: "Forsaking The Forest",
              publish_date: tomorrow,
              author: authors[1]._id
            })
          ].map(r => r.body);

          publishers = [
            await req.post(`/bucket/${publishersBucket._id}/data`, {
              name: "Comcast",
              books: [books[0]._id, books[1]._id]
            }),
            await req.post(`/bucket/${publishersBucket._id}/data`, {
              name: "Newell Brands",
              books: [books[2]._id]
            })
          ].map(r => r.body);

          books = await Promise.all([
            req
              .put(`/bucket/${booksBucket._id}/data/${books[0]._id}`, {
                ...books[0],
                publisher: publishers[0]._id
              })
              .then(r => r.body),
            req
              .put(`/bucket/${booksBucket._id}/data/${books[1]._id}`, {
                ...books[1],
                publisher: publishers[0]._id
              })
              .then(r => r.body),
            req
              .put(`/bucket/${booksBucket._id}/data/${books[2]._id}`, {
                ...books[2],
                publisher: publishers[1]._id
              })
              .then(r => r.body)
          ]);

          //wait until watcher send changes
          await stream.change.next();
        });

        it("should get book with its own publisher", async () => {
          const params = {
            query: `{
              FindBy${booksBucketName}Id(_id: "${books[1]._id}"){
                _id
                title
                publisher{
                  _id
                  name
                }
              }
            }`
          };

          const {body} = await req.get("/graphql", params);

          expect(body).toEqual({
            data: {
              [`FindBy${booksBucketName}Id`]: {
                _id: books[1]._id,
                title: "Goddess Of Earth",
                publisher: {
                  _id: publishers[0]._id,
                  name: "Comcast"
                }
              }
            }
          });
        });

        it("should get books with their own publishers", async () => {
          const params = {
            query: `{
              Find${booksBucketName}{
                meta{
                  total
                }
                data{
                  _id
                  title
                  publisher{
                    _id
                    name
                  }
                }
              }
            }`
          };

          const {body} = await req.get("/graphql", params);

          expect(body).toEqual({
            data: {
              [`Find${booksBucketName}`]: {
                meta: {
                  total: 3
                },
                data: [
                  {
                    _id: books[0]._id,
                    title: "Priest With Vigor",
                    publisher: {
                      _id: publishers[0]._id,
                      name: "Comcast"
                    }
                  },
                  {
                    _id: books[1]._id,
                    title: "Goddess Of Earth",
                    publisher: {
                      _id: publishers[0]._id,
                      name: "Comcast"
                    }
                  },
                  {
                    _id: books[2]._id,
                    title: "Forsaking The Forest",
                    publisher: {
                      _id: publishers[1]._id,
                      name: "Newell Brands"
                    }
                  }
                ]
              }
            }
          });
        });

        it("should get publisher with its own books", async () => {
          const params = {
            query: `{
              FindBy${publishersBucketName}Id(_id: "${publishers[1]._id}"){
                _id
                name
                books{
                  _id
                  title
                }
              }
            }`
          };

          const {body} = await req.get("/graphql", params);
          expect(body).toEqual({
            data: {
              [`FindBy${publishersBucketName}Id`]: {
                _id: publishers[1]._id,
                name: "Newell Brands",
                books: [
                  {
                    _id: books[2]._id,
                    title: "Forsaking The Forest"
                  }
                ]
              }
            }
          });
        });

        it("should get books that belongs to Comcast publisher", async () => {
          const params = {
            query: `{
              Find${booksBucketName}(query: { publisher: { name: Comcast  } }){
                meta{
                  total
                }
                data{
                  _id
                  title
                  publisher{
                    _id
                    name
                  }
                }
              }
            }`
          };

          const {body} = await req.get("/graphql", params);

          expect(body).toEqual({
            data: {
              [`Find${booksBucketName}`]: {
                meta: {
                  total: 2
                },
                data: [
                  {
                    _id: books[0]._id,
                    title: "Priest With Vigor",
                    publisher: {
                      _id: publishers[0]._id,
                      name: "Comcast"
                    }
                  },
                  {
                    _id: books[1]._id,
                    title: "Goddess Of Earth",
                    publisher: {
                      _id: publishers[0]._id,
                      name: "Comcast"
                    }
                  }
                ]
              }
            }
          });
        });

        it("should get publishers which has book named Priest With Vigor", async () => {
          const params = {
            query: `{
              Find${publishersBucketName}(query: { books: { title: "Priest With Vigor"  } }){
                meta{
                  total
                }
                data{
                  _id
                  name
                  books{
                    _id
                    title
                  }
                }
              }
            }`
          };

          const {body} = await req.get("/graphql", params);

          expect(body).toEqual({
            data: {
              [`Find${publishersBucketName}`]: {
                meta: {
                  total: 1
                },
                data: [
                  {
                    _id: publishers[0]._id,
                    name: "Comcast",
                    books: [
                      {
                        _id: books[0]._id,
                        title: "Priest With Vigor"
                      },
                      {
                        _id: books[1]._id,
                        title: "Goddess Of Earth"
                      }
                    ]
                  }
                ]
              }
            }
          });
        });

        it("should get publishers which has the book that matches with the given book id", async () => {
          const params = {
            query: `{
              Find${publishersBucketName}(query: { books: { _id: "${books[2]._id}"  } }){
                meta{
                  total
                }
                data{
                  _id
                  name
                  books{
                    _id
                    title
                  }
                }
              }
            }`
          };

          const {body} = await req.get("/graphql", params);

          expect(body).toEqual({
            data: {
              [`Find${publishersBucketName}`]: {
                meta: {
                  total: 1
                },
                data: [
                  {
                    _id: publishers[1]._id,
                    name: "Newell Brands",
                    books: [
                      {
                        _id: books[2]._id,
                        title: "Forsaking The Forest"
                      }
                    ]
                  }
                ]
              }
            }
          });
        });

        it("should get publishers which has book that will be published at tomorrow", async () => {
          const begin = new Date("2020-10-20T00:00:00.000Z");
          const end = new Date("2020-10-20T23:59:59.999Z");

          const params = {
            query: `{
              Find${publishersBucketName}(query: { books: { publish_date_gt: "${begin.toString()}" , publish_date_lt: "${end.toString()}" } }){
                meta{
                  total
                }
                data{
                  _id
                  name
                  books{
                    _id
                    title
                  }
                }
              }
            }`
          };

          const {body} = await req.get("/graphql", params);

          expect(body).toEqual({
            data: {
              [`Find${publishersBucketName}`]: {
                meta: {
                  total: 1
                },
                data: [
                  {
                    _id: publishers[1]._id,
                    name: "Newell Brands",
                    books: [
                      {
                        _id: books[2]._id,
                        title: "Forsaking The Forest"
                      }
                    ]
                  }
                ]
              }
            }
          });
        });

        it("should resolve nested relations", async () => {
          const params = {
            query: `{
              Find${booksBucketName}{
                meta{
                  total
                }
                data{
                  title
                  publisher{
                    name
                  }
                  author{
                    fullname
                    events{
                      name
                      year
                    }
                  }
                }
              }
            }`
          };

          const {body} = await req.get("/graphql", params);
          expect(body).toEqual({
            data: {
              [`Find${booksBucketName}`]: {
                meta: {
                  total: 3
                },
                data: [
                  {
                    title: "Priest With Vigor",
                    publisher: {
                      name: "Comcast"
                    },
                    author: {
                      fullname: "Jaydon Villa",
                      events: [
                        {
                          name: "Event Rebel",
                          year: 2020
                        },
                        {
                          name: "Seastar Fest",
                          year: 2010
                        }
                      ]
                    }
                  },
                  {
                    title: "Goddess Of Earth",
                    publisher: {
                      name: "Comcast"
                    },
                    author: {
                      fullname: "Jaydon Villa",
                      events: [
                        {
                          name: "Event Rebel",
                          year: 2020
                        },
                        {
                          name: "Seastar Fest",
                          year: 2010
                        }
                      ]
                    }
                  },
                  {
                    title: "Forsaking The Forest",
                    publisher: {
                      name: "Newell Brands"
                    },
                    author: {
                      fullname: "Juan Moody",
                      events: [
                        {
                          name: "Event Rebel",
                          year: 2020
                        }
                      ]
                    }
                  }
                ]
              }
            }
          });
        });

        it("should filter books which has author who joined Seastar Fest", async () => {
          const params = {
            query: `{
              Find${booksBucketName}(query:{author:{events:{name:"Seastar Fest"}}}){
                meta{
                  total
                }
                data{
                  title
                }
              }
            }`
          };

          const {body} = await req.get("/graphql", params);
          expect(body).toEqual({
            data: {
              [`Find${booksBucketName}`]: {
                meta: {
                  total: 2
                },
                data: [
                  {
                    title: "Priest With Vigor"
                  },
                  {
                    title: "Goddess Of Earth"
                  }
                ]
              }
            }
          });
        });

        it("should remove books when publisher deleted", async () => {
          const body = {
            query: `mutation {
              delete${publishersBucketName}(_id: "${publishers[0]._id}")
            }`
          };

          const {body: deleteResponse} = await req.post("/graphql", body);

          expect(deleteResponse).toEqual({
            data: {[`delete${publishersBucketName}`]: ""}
          });

          const params = {
            query: `{
              Find${booksBucketName}{
                meta{
                  total
                }
                data{
                  _id
                  title
                }
              }
            }`
          };

          const {body: booksResponse} = await req.get("/graphql", params);

          expect(booksResponse).toEqual({
            data: {
              [`Find${booksBucketName}`]: {
                meta: {
                  total: 1
                },
                data: [
                  {
                    _id: books[2]._id,
                    title: "Forsaking The Forest"
                  }
                ]
              }
            }
          });
        });
      });
    });

    describe("Mutations", () => {
      let bucketName;
      let bucket;
      let insertedId;
      beforeEach(async () => {
        bucket = await req
          .post("/bucket", {
            title: "Persons",
            description: "Person bucket",
            icon: "view_stream",
            primary: "title",
            properties: {
              name: {
                type: "string",
                title: "Name of the person",
                options: {position: "left"},
                enum: ["James", "John"]
              },
              age: {
                type: "number",
                title: "Age of the person",
                options: {position: "right"}
              }
            },
            required: ["age"]
          })
          .then(response => response.body);

        bucketName = getBucketName(bucket._id);

        //wait until watcher send changes
        await stream.change.next();
      });

      afterEach(async () => {
        await req.delete(`/bucket/${bucket._id}/data/${insertedId}`).catch(e => e);
      });

      it("should insert new person", async () => {
        const insertBody = {
          query: `mutation {
              insert${bucketName}(input: { name: James, age: 66 } ){
                _id
                name
                age
              }
            }`
        };

        const {body} = await req.post("/graphql", insertBody);

        expect(body).toEqual({
          data: {
            [`insert${bucketName}`]: {_id: "__skip__", name: "James", age: 66}
          }
        });

        insertedId = body.data[`insert${bucketName}`]._id;

        //check document
        const params = {
          query: `{
            Find${bucketName}{
              meta{
                total
              }
              data{
                _id
                name
                age
              }
            }
          }`
        };

        const {body: findBody} = await req.post("/graphql", params);

        expect(findBody).toEqual({
          data: {
            [`Find${bucketName}`]: {
              meta: {total: 1},
              data: [{_id: insertedId, name: "James", age: 66}]
            }
          }
        });
      });

      it("should replace person", async () => {
        //insert
        let requestBody = {
          query: `mutation {
              insert${bucketName}(input: { name: James, age: 66 } ){
                _id
                name
                age
              }
            }`
        };
        const {body: insertBody} = await req.post("/graphql", requestBody);
        insertedId = insertBody.data[`insert${bucketName}`]._id;

        //update
        requestBody = {
          query: `mutation {
            replace${bucketName}(_id: "${insertedId}", input: { name: John, age: 12 } ){
              _id
              name
              age
            }
          }`
        };
        const {body: replaceBody} = await req.post("/graphql", requestBody);
        expect(replaceBody).toEqual({
          data: {
            [`replace${bucketName}`]: {_id: "__skip__", name: "John", age: 12}
          }
        });
        //check document
        const params = {
          query: `{
            Find${bucketName}{
              meta{
                total
              }
              data{
                _id
                name
                age
              }
            }
          }`
        };
        const {body: getBody} = await req.post("/graphql", params);
        expect(getBody).toEqual({
          data: {
            [`Find${bucketName}`]: {
              meta: {total: 1},
              data: [{_id: insertedId, name: "John", age: 12}]
            }
          }
        });
      });

      it("should patch person", async () => {
        //insert
        let requestBody = {
          query: `mutation {
              insert${bucketName}(input: { name: James, age: 66 } ){
                _id
                name
                age
              }
            }`
        };
        const {body: insertBody} = await req.post("/graphql", requestBody);
        insertedId = insertBody.data[`insert${bucketName}`]._id;

        //patch
        requestBody = {
          query: `mutation {
            patch${bucketName}(_id: "${insertedId}", input: { name: John } ){
              _id
              name
              age
            }
          }`
        };
        const {body} = await req.post("/graphql", requestBody);
        expect(body).toEqual({
          data: {
            [`patch${bucketName}`]: {_id: "__skip__", name: "John", age: 66}
          }
        });
        //check document
        const params = {
          query: `{
            Find${bucketName}{
              meta{
                total
              }
              data{
                _id
                name
                age
              }
            }
          }`
        };
        const {body: getBody} = await req.post("/graphql", params);
        expect(getBody).toEqual({
          data: {
            [`Find${bucketName}`]: {
              meta: {total: 1},
              data: [{_id: insertedId, name: "John", age: 66}]
            }
          }
        });
      });

      it("should delete person", async () => {
        const requestBody = {
          query: `mutation {
              insert${bucketName}(input: { name: James, age: 66 } ){
                _id
                name
                age
              }
            }`
        };

        const {body} = await req.post("/graphql", requestBody);

        insertedId = body.data[`insert${bucketName}`]._id;

        const deleteBody = {
          query: `mutation {
              delete${bucketName}(_id: "${insertedId}")
            }`
        };

        const {body: deleteResponse} = await req.post("/graphql", deleteBody);

        expect(deleteResponse).toEqual({
          data: {[`delete${bucketName}`]: ""}
        });

        //check document
        const params = {
          query: `{
            Find${bucketName}{
              meta{
                total
              }
              data{
                _id
                name
                age
              }
            }
          }`
        };

        const {body: getBody} = await req.post("/graphql", params);

        expect(getBody).toEqual({
          data: {
            [`Find${bucketName}`]: {
              meta: {total: 0},
              data: []
            }
          }
        });
      });

      describe("errors", () => {
        it("should throw error if name is not one of the enums", async () => {
          const body = {
            query: `mutation {
                insert${bucketName}(input: { name: "David", age: 66 } ){
                  _id
                  name
                  age
                }
              }`
          };

          const error = await req.post("/graphql", body).catch(err => err);

          expect(error.statusCode).toEqual(400);
          expect(error.statusText).toEqual("Bad Request");
          expect(error.body.errors[0].message).toEqual(
            `Enum "${bucketName}_name" cannot represent non-enum value: "David".`
          );
        });

        it("should throw error if required field age is not provided", async () => {
          const body = {
            query: `mutation {
                insert${bucketName}(input: { name: "David" } ){
                  _id
                  name
                  age
                }
              }`
          };

          const error = await req.post("/graphql", body).catch(e => e);

          expect(error.statusCode).toEqual(400);
          expect(error.statusText).toEqual("Bad Request");
          expect(error.body.errors[0].message).toEqual(
            `Field "${bucketName}Input.age" of required type "Int!" was not provided.`
          );
        });

        it("should throw validation error if patched document is not valid", async () => {
          //insert
          let body = {
            query: `mutation {
              insert${bucketName}(input: { name: James, age: 66 } ){
                _id
                name
                age
              }
            }`
          };
          const {body: insertBody} = await req.post("/graphql", body);
          insertedId = insertBody.data[`insert${bucketName}`]._id;

          //patch
          body = {
            query: `mutation {
            patch${bucketName}(_id: "${insertedId}", input: { name: "Karolina"  } ){
              _id
              name
              age
            }
          }`
          };
          const error = await req.post("/graphql", body).catch(e => e);

          expect(error.statusCode).toEqual(400);
          expect(error.statusText).toEqual("Bad Request");
          expect(error.body.errors[0].message).toEqual(
            ".name should be equal to one of the allowed values"
          );
        });
      });
    });
  });

  describe("Errors", () => {
    let bucket;
    let bucketName;
    beforeEach(async () => {
      bucket = await req
        .post("/bucket", {
          title: "bucket",
          description: "bucket",
          properties: {
            title: {
              type: "string"
            },
            relation_field: {
              type: "relation",
              bucketId: "000000000000000000000000",
              relationType: "onetomany"
            },
            "3dmodels": {
              type: "color"
            },
            invalid_enums: {
              type: "string",
              enum: ["?invalid*", "valid"]
            }
          },
          required: ["relation_field", "3dmodels", "invalid_enums"]
        })
        .then(r => r.body);
      bucketName = getBucketName(bucket._id);

      //wait until watcher send changes
      await stream.change.next();
    });

    it("should return response with warnings", async () => {
      const params = {
        query: `{
            Find${bucketName}{
              meta{
                total
              }
            }
          }`
      };

      const response = await req.get("/graphql", params);

      expect(JSON.parse(response.headers.warning)).toEqual([
        {
          target: `${bucketName}.relation_field`,
          reason: "Related bucket '000000000000000000000000' does not exist."
        },
        {
          target: `${bucketName}.3dmodels`,
          reason:
            "Name specification must start with an alphabetic character and can not include any non-word character."
        },
        {
          target: `${bucketName}.invalid_enums`,
          reason:
            "Enum values must start with an alphabetic character and can not include any non-word character."
        }
      ]);

      expect(response.statusCode).toEqual(200);
      expect(response.body).toEqual({
        data: {
          [`Find${bucketName}`]: {
            meta: {total: 0}
          }
        }
      });
    });
  });
});
