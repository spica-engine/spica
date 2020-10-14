import {Test, TestingModule} from "@nestjs/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {
  DATE_TIME,
  OBJECTID_STRING,
  CREATED_AT,
  UPDATED_AT,
  OBJECT_ID
} from "@spica-server/core/schema/defaults";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {BucketModule} from "@spica-server/bucket";
import {INestApplication} from "@nestjs/common";
import {ActivityModule} from "@spica-server/activity";

export function getBucketName(id: string | ObjectId) {
  return `Bucket_${id}`;
}

describe("GraphQLController", () => {
  let app: INestApplication;
  let req: Request;
  let module: TestingModule;
  beforeAll(async () => {
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
          realtime: false
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

  afterAll(async () => await app.close());

  describe("No Bucket", () => {
    beforeEach(async () => {
      const {body: buckets} = await req.get("/bucket");
      if (buckets) {
        let deletes = buckets.map(bucket => req.delete(`/bucket/${bucket._id}`));
        await Promise.all(deletes);

        //wait until bucket watcher send changes
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });

    it("should return default response when there is no bucket ", async () => {
      let params = {
        query: "{spica}"
      };
      let {body} = await req.get("/graphql", params);
      expect(body).toEqual({data: {spica: "Spica"}});
    });
  });

  describe("With Buckets", () => {
    describe("Queries", () => {
      let bucketName;
      let bucket;
      let rows;
      beforeAll(async () => {
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

        //wait until bucket watcher send changes
        await new Promise(resolve => setTimeout(resolve, 100));
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
                entries{
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
              entries: [
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
                entries{
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
              entries: [
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
                  entries{
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
                entries: [
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
                  entries{
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
                entries: [{_id: rows[0]._id, name: "Jim", age: 20}]
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
                  entries{
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
                entries: [{_id: rows[1]._id, name: "Michael", age: 22}]
              }
            }
          });
        });
      });

      describe("sort", () => {
        it("should return documents with sorted as ascend by id", async () => {
          const params = {
            query: `{
                Find${bucketName}(sort:{_id:1}){
                  meta{
                    total
                  }
                  entries{
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
                entries: [
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
        it("should return documents with sorted as descend by id", async () => {
          const params = {
            query: `{
              Find${bucketName}(sort:{_id:-1}){
                meta{
                  total
                }
                entries{
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
                entries: [
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

        it("should return documents with sorted as ascend by name", async () => {
          const params = {
            query: `{
                Find${bucketName}(sort:{name:1}){
                  meta{
                    total
                  }
                  entries{
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
                entries: [
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

        it("should return documents with sorted as descend by name", async () => {
          const params = {
            query: `{
                Find${bucketName}(sort:{name:-1}){
                  meta{
                    total
                  }
                  entries{
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
                entries: [
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
                Find${bucketName}(query: { name: Kevin }){
                  meta{
                    total
                  }
                  entries{
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
                entries: [{_id: rows[2]._id, name: "Kevin", age: 25}]
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
                  entries{
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
                entries: [
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

        beforeAll(async () => {
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
            .then(response => response.body);

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

          //wait until bucket watcher send changes
          await new Promise(resolve => setTimeout(resolve, 100));
        });

        it("should return documents with english titles", async () => {
          const params = {
            query: `{
                Find${languageBucketName}(language: "EN"){
                  meta{
                    total
                  }
                  entries{
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
                entries: [
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
                  entries{
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
                entries: [
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
                  entries{
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
                entries: [
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
                FindBy${languageBucketName}Id(_id: "${languageRows[1]._id}"){
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
                title: "new english words",
                description: "description"
              }
            }
          });
        });
      });

      //filter by relation entry???
      describe("relation", () => {
        let booksBucket;
        let booksBucketName;

        let publishersBucket;
        let publishersBucketName;

        let books;
        let publisher;

        beforeAll(async () => {
          booksBucket = {
            title: "Books",
            description: "Books",
            properties: {
              title: {
                type: "string"
              }
            }
          };

          publishersBucket = {
            title: "Publisher",
            description: "Publisher",
            properties: {
              name: {
                type: "string"
              }
            }
          };

          booksBucket = await req.post("/bucket", booksBucket).then(response => response.body);

          booksBucketName = getBucketName(booksBucket._id);

          publishersBucket.properties.books = {
            type: "relation",
            relationType: "onetomany",
            bucketId: booksBucket._id
          };
          publishersBucket = await req
            .post("/bucket", publishersBucket)
            .then(response => response.body);

          publishersBucketName = getBucketName(publishersBucket._id);

          booksBucket.properties.publisher = {
            type: "relation",
            relationType: "onetoone",
            bucketId: publishersBucket._id
          };

          booksBucket = await req
            .put(`/bucket/${booksBucket._id}`, booksBucket)
            .then(response => response.body);

          //insert data
          books = [
            await req.post(`/bucket/${booksBucket._id}/data`, {
              title: "Priest With Vigor"
            }),
            await req.post(`/bucket/${booksBucket._id}/data`, {
              title: "Goddess Of Earth"
            })
          ].map(r => r.body);

          publisher = await req
            .post(`/bucket/${publishersBucket._id}/data`, {
              name: "Comcast",
              books: books.map(b => b._id)
            })
            .then(res => res.body);

          let bookUpdates = books.map(book =>
            req.put(`/bucket/${booksBucket._id}/data/${book._id}`, {
              ...book,
              publisher: publisher._id
            })
          );

          await Promise.all(bookUpdates);

          //wait until bucket watcher send changes
          await new Promise(resolve => setTimeout(resolve, 100));
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
                  _id: publisher._id,
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
                entries{
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
                entries: [
                  {
                    _id: books[0]._id,
                    title: "Priest With Vigor",
                    publisher: {
                      _id: publisher._id,
                      name: "Comcast"
                    }
                  },
                  {
                    _id: books[1]._id,
                    title: "Goddess Of Earth",
                    publisher: {
                      _id: publisher._id,
                      name: "Comcast"
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
              FindBy${publishersBucketName}Id(_id: "${publisher._id}"){
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
                _id: publisher._id,
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
            }
          });
        });
      });
    });
  });
});
