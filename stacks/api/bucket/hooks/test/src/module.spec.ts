import {Test, TestingModule} from "@nestjs/testing";
import {hookModuleProviders} from "@spica-server/bucket/hooks";
import {ServicesModule} from "@spica-server/bucket/services";
import {DatabaseTestingModule, DatabaseService, stream} from "@spica-server/database/testing";
import {PreferenceModule} from "@spica-server/preference";
import {createSchema} from "../../src/module";
import {take, bufferCount} from "rxjs/operators";
import {from} from "rxjs";

describe("hook module", () => {
  describe("schema", () => {
    let module: TestingModule;
    let database: DatabaseService;

    beforeEach(async () => {
      module = await Test.createTestingModule({
        imports: [ServicesModule, DatabaseTestingModule.replicaSet(), PreferenceModule],
        providers: hookModuleProviders
      }).compile();

      database = module.get(DatabaseService);
    }, 120000);

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
        required: ["bucket", "type"],
        properties: {
          bucket: {
            title: "Bucket",
            type: "string",
            enum: []
          },
          type: {
            title: "Operation type",
            description: "Event Type",
            type: "string",
            enum: ["INSERT", "INDEX", "GET", "UPDATE"]
          }
        },
        additionalProperties: false
      });
    });

    it("should report when a bucket has been created", async done => {
      const schema = createSchema(database);
      await database.collection("buckets").insertOne({_id: "bucket1"});
      from(schema)
        .pipe(
          bufferCount(2),
          take(1)
        )
        .subscribe(changes => {
          let collections = changes.map(c => c.properties.bucket["enum"]);
          expect(collections).toEqual([["bucket1"], ["bucket1", "bucket2"]]);
          done();
        });
      await stream.wait();
      await database.collection("buckets").insertOne({_id: "bucket2"});
    });

    it("should report when a bucket has been dropped", async done => {
      const schema = createSchema(database);
      await database.collection("buckets").insertOne({_id: "bucket1"});
      from(schema)
        .pipe(
          bufferCount(2),
          take(1)
        )
        .subscribe(changes => {
          let collections = changes.map(c => c.properties.bucket["enum"]);
          expect(collections).toEqual([["bucket1"], []]);
          done();
        });
      await stream.wait();
      await database.collection("buckets").deleteOne({_id: "bucket1"});
    });
  });
});
