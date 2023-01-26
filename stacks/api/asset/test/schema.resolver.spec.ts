import {Test, TestingModule} from "@nestjs/testing";
import {ObjectId} from "@spica-server/database";
import {SchemaModule} from "@spica-server/core/schema";
import {DatabaseTestingModule, stream} from "@spica-server/database/testing";
import {Asset} from "@spica-server/interface/asset";
import {AssetInstallSchemaResolver} from "@spica-server/asset/src/schema.resolver";
import {AssetService} from "@spica-server/asset/src/service";

describe("Schema Validation", () => {
  let module: TestingModule;
  let installSchemaResolver: AssetInstallSchemaResolver;
  let assetService: AssetService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [SchemaModule.forChild(), DatabaseTestingModule.replicaSet()],
      providers: [AssetInstallSchemaResolver, AssetService]
    }).compile();

    installSchemaResolver = module.get(AssetInstallSchemaResolver);
    assetService = module.get(AssetService);
  });

  describe("Install", () => {
    let asset: Asset;

    beforeEach(async () => {
      asset = {
        icon:"icon1",
        _id: "6399a8db01e9930e9bff5a3c",
        name: "my-asset",
        url: "mock_url",
        status: "downloaded",
        resources: [],
        description: "install it",
        configs: [
          {
            title: "I am the optional config",
            module: "bucket",
            property: "icon",
            submodule: "schema",
            resource_id: "123123",
            type: "string",
            value: "view_stream"
          },
          {
            title: "I am the required config",
            module: "bucket",
            property: "primary",
            submodule: "schema",
            resource_id: "123123",
            type: "string"
          }
        ]
      };
      await assetService.insertOne(asset);

      await new Promise(resolve => setTimeout(resolve, 5000));
    }, 10_000);

    it("should create schema to install asset", async () => {
      const schema = await installSchemaResolver
        .resolve(new ObjectId("6399a8db01e9930e9bff5a3c"))
        .toPromise();

      const iconConfigSchema = {
        type: "object",
        additionalProperties: false,
        required: ["module", "property", "submodule", "resource_id"],
        properties: {
          value: {type: "string", default: "view_stream"},
          module: {const: "bucket"},
          property: {const: "icon"},
          submodule: {const: "schema"},
          resource_id: {const: "123123"}
        }
      };

      const primaryConfigSchema = {
        type: "object",
        additionalProperties: false,
        required: ["value", "module", "property", "submodule", "resource_id"],
        properties: {
          value: {type: "string"},
          module: {const: "bucket"},
          property: {const: "primary"},
          submodule: {const: "schema"},
          resource_id: {const: "123123"}
        }
      };

      expect(schema).toEqual({
        $id: `http://spica.internal/asset/${asset._id}/install`,
        type: "object",
        required: ["configs"],
        properties: {
          configs: {
            type: "array",
            items: {
              anyOf: [iconConfigSchema, primaryConfigSchema]
            },
            contains: {
              allOf: [primaryConfigSchema]
            }
          }
        },
        additionalProperties: false
      });
    });

    it("should wait empty config if asset is not configurable", () => {});
  });
});
