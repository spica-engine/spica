import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket";
import {SchemaModule} from "@spica-server/core/schema";
import {DATE_TIME, OBJECTID_STRING, OBJECT_ID} from "@spica-server/core/schema/formats";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {CoreTestingModule, Websocket} from "@spica-server/core/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import * as Bucket from "@spica-devkit/bucket";
import {bufferCount, take} from "rxjs/operators";
import {WsAdapter} from "@spica-server/core/websocket";

const PORT = 3002;
const PUBLIC_URL = `http://localhost:${PORT}`;

describe("Bucket", () => {
  let wsc: Websocket;
  let module: TestingModule;
  let app: INestApplication;

  let bucket;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        SchemaModule.forRoot({formats: [OBJECT_ID, OBJECTID_STRING, DATE_TIME]}),
        DatabaseTestingModule.replicaSet(),
        CoreTestingModule,
        PassportTestingModule.initialize({
          overriddenStrategyType: "identity"
        }),
        PreferenceTestingModule,
        BucketModule.forRoot({
          cache: false,
          history: false,
          hooks: false,
          realtime: true,
          bucketDataLimit: 100,
          graphql: false
        })
      ]
    }).compile();

    wsc = module.get(Websocket);
    app = module.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.listen(PORT);

    bucket = {
      title: "New Bucket",
      description: "Description of the bucket",
      primary: "title",
      properties: {
        title: {type: "string", options: {position: "left"}},
        description: {type: "string", options: {position: "right"}}
      },
      history: false,
      acl: {write: "true==true", read: "true==true"},
      icon: "view_stream"
    };

    Bucket.initialize({identity: "token", publicUrl: PUBLIC_URL});
  });

  afterEach(async () => await app.close());

  describe("Bucket", () => {
    it("should create bucket", async () => {
      const insertedBucket = await Bucket.insert(bucket);
      expect(ObjectId.isValid(insertedBucket._id)).toEqual(true);
      expect(insertedBucket).toEqual({...bucket, _id: insertedBucket._id});
    });

    it("should update bucket", async () => {
      const insertResponse = await Bucket.insert(bucket);

      const updatedBucket = {...insertResponse, history: true};

      const updateResponse = await Bucket.update(insertResponse._id, updatedBucket);
      expect(updateResponse).toEqual(updatedBucket);
    });

    it("should delete bucket", async () => {
      const insertedBucket = await Bucket.insert(bucket);

      await Bucket.remove(insertedBucket._id);

      const existingBuckets = await Bucket.getAll();
      expect(existingBuckets).toEqual([]);
    });

    it("should get bucket", async () => {
      const insertedBucket = await Bucket.insert(bucket);
      const existingBucket = await Bucket.get(insertedBucket._id);
      expect(existingBucket).toEqual(insertedBucket);
    });

    it("should get buckets", async () => {
      const bucket1 = bucket;
      const bucket2 = {...bucket, icon: "bookmark"};

      const bucket1Id = await Bucket.insert(bucket1).then(r => r._id);
      const bucket2Id = await Bucket.insert(bucket2).then(r => r._id);

      const existingBuckets = await Bucket.getAll();

      expect(existingBuckets).toEqual([
        {...bucket1, _id: bucket1Id},
        {...bucket2, _id: bucket2Id}
      ]);
    });
  });

  describe("Bucket data", () => {
    let bucketid;

    beforeEach(async () => {
      const insertedBucket = await Bucket.insert(bucket);
      bucketid = insertedBucket._id;
    });

    it("should insert", async () => {
      const expectedData = {_id: undefined, title: "hello", description: "hi"};

      const insertedData = await Bucket.data.insert<any>(bucketid, {
        title: "hello",
        description: "hi"
      });
      expect(ObjectId.isValid(insertedData._id)).toEqual(true);

      expectedData._id = insertedData._id;
      expect(insertedData).toEqual(expectedData);

      const existingData = await Bucket.data.getAll<any>(bucketid);
      expect(existingData).toEqual([expectedData]);
    });

    it("should update", async () => {
      const insertedData = await Bucket.data.insert<any>(bucketid, {
        title: "hello",
        description: "hi"
      });
      const updatedData = await Bucket.data.update(bucketid, insertedData._id, {
        title: "hi",
        description: "hi"
      });

      const expectedData = {title: "hi", description: "hi", _id: insertedData._id};

      expect(updatedData).toEqual(expectedData);

      const existingData = await Bucket.data.getAll<any>(bucketid);
      expect(existingData).toEqual([expectedData]);
    });

    it("should patch", async () => {
      const insertedData = await Bucket.data.insert<any>(bucketid, {
        title: "hello",
        description: "hi"
      });
      const pacthedData = await Bucket.data.patch(bucketid, insertedData._id, {
        title: null
      });

      const expectedData = {description: "hi", _id: insertedData._id};

      expect(pacthedData).toEqual(expectedData);

      const existingData = await Bucket.data.getAll<any>(bucketid);
      expect(existingData).toEqual([expectedData]);
    });

    it("should delete", async () => {
      const insertedData = await Bucket.data.insert<any>(bucketid, {
        title: "hello",
        description: "hi"
      });
      await Bucket.data.remove(bucketid, insertedData._id);

      const existingData = await Bucket.data.getAll(bucketid);
      expect(existingData).toEqual([]);
    });

    it("should get", async () => {
      const insertedData = await Bucket.data.insert<any>(bucketid, {
        title: "hello",
        description: "hi"
      });

      const existingData = await Bucket.data.get(bucketid, insertedData._id);
      expect(existingData).toEqual({_id: insertedData._id, title: "hello", description: "hi"});
    });

    it("should getAll", async () => {
      const insertedId = await Bucket.data
        .insert<any>(bucketid, {
          title: "hello",
          description: "hi"
        })
        .then(r => r._id);

      const existingData = await Bucket.data.getAll(bucketid);
      expect(existingData).toEqual([{_id: insertedId, title: "hello", description: "hi"}]);
    });

    // suggestion: test them separately
    it("should getAll with query params", async () => {
      // we should make sure that this one was inserted first
      await Bucket.data
        .insert<any>(bucketid, {
          title: "doc1",
          description: "desc1"
        })
        .then(r => r._id);

      const expectedId = await Bucket.data
        .insert<any>(bucketid, {
          title: "doc1",
          description: "desc2"
        })
        .then(r => r._id);

      await Bucket.data.insert<any>(bucketid, {
        title: "doc2"
      });

      const existingData = await Bucket.data.getAll(bucketid, {
        queryParams: {paginate: true, limit: 1, skip: 1, filter: {title: "doc1"}}
      });
      expect(existingData).toEqual({
        meta: {total: 2},
        data: [
          {
            _id: expectedId,
            title: "doc1",
            description: "desc2"
          }
        ]
      });
    });

    describe("realtime", () => {
      it("should get changes in realtime", done => {
        let insertedId;
        const subject = Bucket.data.realtime.getAll(bucketid);
        subject.pipe(bufferCount(2), take(1)).subscribe({
          next: messages => {
            expect(messages).toEqual([
              // initial docs
              [],
              // docs after changes
              [{_id: insertedId, title: "hey", description: "it's me"}]
            ]);
            done();
          }
        });

        setTimeout(
          () =>
            Bucket.data
              .insert<any>(bucketid, {title: "hey", description: "it's me"})
              .then(r => (insertedId = r._id)),
          1000
        );
      });

      it("should get changes in realtime for single document", done => {
        const bucketData = {
          title: "title1",
          description: "description1"
        };

        Bucket.data.insert<any>(bucketid, bucketData).then(r => {
          const bucketDataid = r._id;
          const subject = Bucket.data.realtime.get(bucketid, bucketDataid);
          subject.pipe(bufferCount(2), take(1)).subscribe(messages => {
            expect(messages).toEqual([
              {
                _id: bucketDataid,
                title: "title1",
                description: "description1"
              },
              {
                _id: bucketDataid,
                title: "updated_title1",
                description: "description1"
              }
            ]);
            done();
          });

          setTimeout(() => {
            // this insert should not be passed to the realtime changes
            Bucket.data.insert(bucketid, {title: "unrelated_document"});
            Bucket.data.patch(bucketid, bucketDataid, {title: "updated_title1"});
          }, 1000);
        });
      });

      it("should insert document via realtime connection", done => {
        const callbackSpy = jest.fn();

        const subject = Bucket.data.realtime.getAll(bucketid, {}, callbackSpy);
        subject.pipe(bufferCount(2), take(1)).subscribe(messages => {
          const documentId = messages[1][0]["_id"];
          expect(ObjectId.isValid(documentId)).toBe(true);
          expect(messages).toEqual([[], [{_id: documentId, title: "new doc"}]]);
          expect(callbackSpy).toHaveBeenCalledWith({status: 201, message: "Created"});
          done();
        });

        setTimeout(() => subject.insert({title: "new doc"}), 1000);
      });

      it("should patch document via realtime connection", done => {
        const callbackSpy = jest.fn();

        const bucketData = {
          title: "title1",
          description: "description1"
        };

        Bucket.data.insert<any>(bucketid, bucketData).then(r => {
          const bucketDataid = r._id;
          const subject = Bucket.data.realtime.get(bucketid, bucketDataid, callbackSpy);
          subject.pipe(bufferCount(2), take(1)).subscribe(messages => {
            expect(messages).toEqual([
              {
                _id: bucketDataid,
                title: "title1",
                description: "description1"
              },
              {
                _id: bucketDataid,
                description: "description1"
              }
            ]);
            expect(callbackSpy).toHaveBeenCalledWith({status: 204, message: "No Content"});
            done();
          });

          setTimeout(() => {
            subject.patch({_id: bucketDataid, title: null});
          }, 1000);
        });
      });

      it("should replace document via realtime connection", done => {
        const callbackSpy = jest.fn();

        const bucketData = {
          title: "title1",
          description: "description1"
        };

        Bucket.data.insert<any>(bucketid, bucketData).then(r => {
          const bucketDataid = r._id;
          const subject = Bucket.data.realtime.get(bucketid, bucketDataid, callbackSpy);
          subject.pipe(bufferCount(2), take(1)).subscribe(messages => {
            expect(messages).toEqual([
              {
                _id: bucketDataid,
                title: "title1",
                description: "description1"
              },
              {
                _id: bucketDataid,
                title: "updated_title",
                description: "description1"
              }
            ]);
            expect(callbackSpy).toHaveBeenCalledWith({status: 200, message: "OK"});
            done();
          });

          setTimeout(() => {
            subject.replace({
              _id: bucketDataid,
              title: "updated_title",
              description: "description1"
            });
          }, 1000);
        });
      });

      it("should delete document via realtime connection", done => {
        const callbackSpy = jest.fn();

        const bucketData = {
          title: "title1",
          description: "description1"
        };

        Bucket.data.insert<any>(bucketid, bucketData).then(r => {
          const bucketDataid = r._id;
          const subject = Bucket.data.realtime.getAll(bucketid, {}, callbackSpy);
          subject.pipe(bufferCount(2), take(1)).subscribe(messages => {
            expect(messages).toEqual([
              [
                {
                  _id: bucketDataid,
                  title: "title1",
                  description: "description1"
                }
              ],
              []
            ]);
            expect(callbackSpy).toHaveBeenCalledWith({status: 204, message: "No Content"});
            done();
          });

          setTimeout(() => {
            subject.remove({_id: bucketDataid});
          }, 1000);
        });
      });
    });
  });
});
