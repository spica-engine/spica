import {Test, TestingModule} from "@nestjs/testing";
import {createSchema} from "@spica-server/bucket-hooks/src/module";
import {contractSuite} from "@spica-server/database-testing";
import {provideRepository} from "@spica-server/data";
import {BUCKET_REPOSITORY} from "@spica-server/interface-bucket";

contractSuite("hook module", engine => {
  describe("schema", () => {
    let module: TestingModule;

    beforeEach(async () => {
      module = await Test.createTestingModule({
        imports: [engine.module()],
        providers: [provideRepository(BUCKET_REPOSITORY)]
      }).compile();
    });

    afterEach(async () => {
      await module.close();
    });

    it("should get initial schema", async () => {
      const expectedSchema: any = {
        $id: "http://spica.internal/function/enqueuer/bucket",
        type: "object",
        required: ["bucket", "type"],
        properties: {
          bucket: {
            title: "Bucket",
            type: "string",
            enum: [null],
            viewEnum: [null],
            description: "Bucket id that the event will be tracked on"
          },
          type: {
            title: "Operation type",
            type: "string",
            enum: ["ALL", "INSERT", "UPDATE", "DELETE"],
            description: "Operation type that must be performed in the specified bucket"
          }
        },
        additionalProperties: false
      };

      const schema = await createSchema(module.get(BUCKET_REPOSITORY));
      expect(schema).toEqual(expectedSchema);
    });
  });
});
