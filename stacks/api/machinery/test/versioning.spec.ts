import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket";
import {BucketService} from "@spica-server/bucket/services";
import {CoreTestingModule} from "@spica-server/core/testing";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {Synchronizer, ApiMachineryModule, RepresentativeManager} from "@spica-server/machinery";
import {PreferenceTestingModule} from "@spica-server/preference/testing";

describe("Versioning", () => {
  describe("Synchronization between database and files", () => {
    let module: TestingModule;
    let app: INestApplication;
    let synchronizer: Synchronizer;
    let bs: BucketService;
    let rep: RepresentativeManager;

    beforeEach(async () => {
      module = await Test.createTestingModule({
        imports: [
          ApiMachineryModule,
          CoreTestingModule,
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
      synchronizer = module.get(Synchronizer);
      bs = module.get(BucketService);
      rep = module.get(RepresentativeManager);
    });

    afterEach(() => rep._reset());

    it("should make first synchronization", async () => {
      const id = new ObjectId();
      const bucket: any = {
        _id: id,
        title: "bucket1",
        properties: {
          title: {
            type: "string",
            options: {position: "bottom"}
          }
        },
        acl: {read: "true==true", write: "true==true"},
        primary: "title"
      };

      await bs.insertOne(bucket);

      await synchronizer.synchronize(["bucket"]);

      const file = await rep.read("bucket", id.toString());

      expect(file).toEqual({schema: {...bucket, _id: id.toString()}});
    });

    it("should update if schema has changes", async () => {
      const id = new ObjectId();
      const bucket: any = {
        _id: id,
        title: "bucket1",
        properties: {
          title: {
            type: "string",
            options: {position: "bottom"}
          }
        },
        acl: {read: "true==true", write: "true==true"},
        primary: "title"
      };

      await bs.insertOne(bucket);
      await synchronizer.synchronize(["bucket"]);

      await bs.updateOne({_id: id}, {$set: {"properties.title.type": "number"}});
      await synchronizer.synchronize(["bucket"]);

      const file = await rep.read("bucket", id.toString());
      const expectedBucket = {...bucket, _id: id.toString()};
      expectedBucket.properties.title.type = "number";

      expect(file).toEqual({schema: expectedBucket});
    });

    it("should delete if schema has been deleted", async () => {
      const id = new ObjectId();
      const bucket: any = {
        _id: id,
        title: "bucket1",
        properties: {
          title: {
            type: "string",
            options: {position: "bottom"}
          }
        },
        acl: {read: "true==true", write: "true==true"},
        primary: "title"
      };

      await bs.insertOne(bucket);
      await synchronizer.synchronize(["bucket"]);

      await bs.findOneAndDelete({_id: id});
      await synchronizer.synchronize(["bucket"]);

      // it takes some time to remove
      const file = await rep.read("bucket", id.toString());
      expect(file).toEqual({});
    });
  });
});
