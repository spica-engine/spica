import {Test, TestingModule} from "@nestjs/testing";
import {createSchema} from "@spica-server/bucket/hooks/src/module";
import {ServicesModule} from "@spica-server/bucket/services";
import {
  DatabaseService,
  DatabaseTestingModule,
  ObjectId,
  stream
} from "@spica-server/database/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {from} from "rxjs";
import {bufferCount, take} from "rxjs/operators";

describe("hook module", () => {
  describe("schema", () => {
    let module: TestingModule;
    let database: DatabaseService;

    beforeEach(async () => {
      module = await Test.createTestingModule({
        imports: [ServicesModule, DatabaseTestingModule.replicaSet(), PreferenceTestingModule]
      }).compile();

      database = module.get(DatabaseService);
    });

    afterEach(async () => {
      await module.close();
    });

    it("should get initial schema", async () => {
      let schema = await createSchema(database)
        .pipe(take(1))
        .toPromise();
      expect(schema).toEqual({
        $id: "http://spica.internal/function/enqueuer/bucket",
        type: "object",
        required: ["bucket", "phase", "type"],
        properties: {
          bucket: {
            title: "Bucket",
            type: "string",
            enum: [],
            // @ts-expect-error
            viewEnum: []
          },
          phase: {
            title: "Phase",
            type: "string",
            enum: ["BEFORE", "AFTER"]
          },
          type: {
            type: "string"
          }
        },
        if: {
          properties: {
            phase: {const: "BEFORE"}
          }
        },
        then: {
          properties: {
            type: {
              title: "Operation type",
              type: "string",
              enum: ["INSERT", "INDEX", "GET", "UPDATE", "DELETE", "STREAM"]
            }
          }
        },
        else: {
          properties: {
            type: {
              title: "Operation type",
              type: "string",
              enum: ["ALL", "INSERT", "UPDATE", "DELETE"]
            }
          }
        },
        additionalProperties: false
      });
    });

    it("should report when a bucket has been created", async done => {
      const schema = createSchema(database);
      const {insertedId: firstBucket} = await database.collection("buckets").insertOne({});
      from(schema)
        .pipe(
          bufferCount(2),
          take(1)
        )
        .subscribe(changes => {
          let collections = changes.map(c => c.properties.bucket["enum"]);
          expect(collections).toEqual([
            [firstBucket.toHexString()],
            [firstBucket.toHexString(), secondBucket.toHexString()]
          ]);
          done();
        });
      await stream.wait();
      const {insertedId: secondBucket} = await database.collection("buckets").insertOne({});
    });

    it("should report when a bucket has been dropped", async done => {
      const schema = createSchema(database);
      const bucketId = new ObjectId();
      await database.collection("buckets").insertOne({_id: bucketId});
      from(schema)
        .pipe(
          bufferCount(2),
          take(1)
        )
        .subscribe(changes => {
          let collections = changes.map(c => c.properties.bucket["enum"]);
          expect(collections).toEqual([[bucketId.toHexString()], []]);
          done();
        });
      await stream.wait();
      await database.collection("buckets").deleteOne({_id: bucketId});
    });
  });
});
