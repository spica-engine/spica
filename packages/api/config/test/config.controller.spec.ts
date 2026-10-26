import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {SchemaModule} from "@spica-server/core-schema";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {PassportTestingModule} from "@spica-server/passport-testing";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {ConfigModule} from "../src/config.module";
import {ConfigService} from "../src/config.service";
import {ConfigSchemaRegistry} from "../src/config.schema.registry";

describe("ConfigSchemaRegistry", () => {
  let registry: ConfigSchemaRegistry;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [SchemaModule.forChild({})],
      providers: [ConfigSchemaRegistry]
    }).compile();
    registry = module.get(ConfigSchemaRegistry);
  });

  describe("register", () => {
    it("should register a module schema", () => {
      registry.register("bucket", {type: "object"});
      expect(registry.hasModule("bucket")).toBe(true);
    });

    it("should overwrite existing schema on re-registration", () => {
      registry.register("bucket", {type: "object", properties: {a: {type: "string"}}});
      registry.register("bucket", {type: "object", properties: {b: {type: "number"}}});

      const schema = registry.buildCompositeSchema() as any;
      expect(schema.anyOf).toHaveLength(1);
      expect(schema.anyOf[0].properties.options.properties.b).toBeDefined();
      expect(schema.anyOf[0].properties.options.properties.a).toBeUndefined();
    });
  });

  describe("hasModule", () => {
    it("should return false for unregistered module", () => {
      expect(registry.hasModule("unknown")).toBe(false);
    });

    it("should return true for registered module", () => {
      registry.register("function", {type: "object"});
      expect(registry.hasModule("function")).toBe(true);
    });
  });

  describe("getModuleNames", () => {
    it("should return empty array when no modules registered", () => {
      expect(registry.getModuleNames()).toEqual([]);
    });

    it("should return all registered module names", () => {
      registry.register("bucket", {type: "object"});
      registry.register("function", {type: "object"});
      registry.register("storage", {type: "object"});
      expect(registry.getModuleNames()).toEqual(["bucket", "function", "storage"]);
    });
  });

  describe("buildCompositeSchema", () => {
    it("should build anyOf schema from registered modules", () => {
      registry.register("bucket", {
        type: "object",
        properties: {maxLimit: {type: "number"}}
      });
      registry.register("function", {
        type: "object",
        properties: {timeout: {type: "number"}}
      });

      const schema = registry.buildCompositeSchema() as any;
      expect(schema.anyOf).toHaveLength(2);

      const bucketBranch = schema.anyOf.find((b: any) => b.properties.module.const === "bucket");
      expect(bucketBranch).toBeDefined();
      expect(bucketBranch.required).toEqual(["module", "options"]);
      expect(bucketBranch.properties.options.properties.maxLimit.type).toBe("number");
      expect(bucketBranch.additionalProperties).toBe(false);

      const functionBranch = schema.anyOf.find(
        (b: any) => b.properties.module.const === "function"
      );
      expect(functionBranch).toBeDefined();
      expect(functionBranch.properties.options.properties.timeout.type).toBe("number");
    });

    it("should return a schema that rejects everything when no modules registered", () => {
      const schema = registry.buildCompositeSchema() as any;
      expect(schema.anyOf).toEqual([{not: {}}]);
    });
  });

  describe("validate", () => {
    beforeEach(() => {
      registry.register("bucket", {
        type: "object",
        properties: {maxLimit: {type: "number"}}
      });
      registry.register("function", {
        type: "object",
        properties: {timeout: {type: "number"}}
      });
    });

    it("should accept valid data for a registered module", async () => {
      await expect(
        registry.validate({module: "bucket", options: {maxLimit: 100}})
      ).resolves.not.toThrow();
    });

    it("should accept valid data for another registered module", async () => {
      await expect(
        registry.validate({module: "function", options: {timeout: 5000}})
      ).resolves.not.toThrow();
    });

    it("should reject data with unregistered module name", async () => {
      await expect(registry.validate({module: "nonexistent", options: {}})).rejects.toThrow();
    });

    it("should reject data with wrong option types", async () => {
      await expect(
        registry.validate({module: "bucket", options: {maxLimit: "not-a-number"}})
      ).rejects.toThrow();
    });

    it("should reject data missing required fields", async () => {
      await expect(registry.validate({module: "bucket"} as any)).rejects.toThrow();
    });

    it("should reject data with additional properties", async () => {
      await expect(
        registry.validate({module: "bucket", options: {}, extra: "field"} as any)
      ).rejects.toThrow();
    });

    it("should recompile validator after new registration", async () => {
      await expect(registry.validate({module: "storage", options: {}})).rejects.toThrow();

      registry.register("storage", {type: "object"});

      await expect(registry.validate({module: "storage", options: {}})).resolves.not.toThrow();
    });
  });

  describe("validateModule", () => {
    it("should throw for unregistered module", () => {
      expect(() => registry.validateModule("unknown")).toThrow();
    });

    it("should not throw for registered module", () => {
      registry.register("bucket", {type: "object"});
      expect(() => registry.validateModule("bucket")).not.toThrow();
    });

    it("should include registered module names in error message", () => {
      registry.register("bucket", {type: "object"});
      registry.register("function", {type: "object"});
      expect(() => registry.validateModule("storage")).toThrow(/bucket/);
      expect(() => registry.validateModule("storage")).toThrow(/function/);
    });
  });
});

describe("ConfigController", () => {
  let request: Request;
  let app: INestApplication;
  let configService: ConfigService;
  let registry: ConfigSchemaRegistry;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        CoreTestingModule,
        PassportTestingModule.initialize(),
        ConfigModule.forRoot(),
        DatabaseTestingModule.standalone()
      ]
    }).compile();

    request = module.get(Request);
    configService = module.get(ConfigService);
    registry = module.get(ConfigSchemaRegistry);

    registry.register("bucket", {
      type: "object",
      properties: {
        maxLimit: {type: "number"},
        enableCache: {type: "boolean"}
      },
      additionalProperties: false
    });
    registry.register("function", {
      type: "object",
      properties: {
        timeout: {type: "number"},
        maxMemory: {type: "number"}
      }
    });

    app = module.createNestApplication();
    await app.listen(request.socket);
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /config", () => {
    it("should return empty array when no configs exist", async () => {
      const response = await request.get("/config");
      expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
      expect(response.body).toEqual([]);
    });

    it("should return all configurations", async () => {
      await configService.insertOne({
        module: "bucket",
        options: {maxLimit: 100, enableCache: true}
      });
      await configService.insertOne({
        module: "function",
        options: {timeout: 30000, maxMemory: 512}
      });

      const response = await request.get("/config");
      expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].module).toBe("bucket");
      expect(response.body[1].module).toBe("function");
    });
  });

  describe("GET /config/:module", () => {
    it("should return 400 for unregistered module name", async () => {
      const response = await request.get("/config/invalid_module");
      expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
      expect(response.body.message).toContain("not registered");
    });

    it("should return 404 when config does not exist for registered module", async () => {
      const response = await request.get("/config/bucket");
      expect([response.statusCode, response.statusText]).toEqual([404, "Not Found"]);
      expect(response.body.message).toContain("Configuration with module bucket does not exist");
    });

    it("should get the correct config when multiple configs exist", async () => {
      await configService.insertOne({module: "bucket", options: {maxLimit: 100}});
      await configService.insertOne({module: "function", options: {timeout: 30000}});

      const response = await request.get("/config/function");
      expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
      expect(response.body.module).toBe("function");
      expect(response.body.options).toEqual({timeout: 30000});
    });
  });

  describe("PUT /config/:module", () => {
    it("should upsert a new config with valid data", async () => {
      const newConfig = {maxLimit: 100, enableCache: true};
      const response = await request.put("/config/bucket", newConfig);
      expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
      expect(response.body.module).toBe("bucket");
      expect(response.body.options).toEqual({maxLimit: 100, enableCache: true});
    });

    it("should update an existing config", async () => {
      await configService.insertOne({
        module: "bucket",
        options: {maxLimit: 100, enableCache: true}
      });
      const updatedConfig = {maxLimit: 200, enableCache: false};
      const response = await request.put("/config/bucket", updatedConfig);
      expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
      expect(response.body.options.maxLimit).toBe(200);
      expect(response.body.options.enableCache).toBe(false);
    });

    it("should replace entire config on update", async () => {
      await configService.insertOne({
        module: "bucket",
        options: {maxLimit: 100, enableCache: true}
      });
      const partialUpdate = {maxLimit: 150};
      const response = await request.put("/config/bucket", partialUpdate);
      expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
      expect(response.body.options).toEqual({maxLimit: 150});

      const getResponse = await request.get("/config/bucket");
      expect(getResponse.body.options.enableCache).toBeUndefined();
    });

    it("should return 400 for unregistered module", async () => {
      const newConfig = {someSetting: true};
      const response = await request.put("/config/nonexistent", newConfig);
      expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
    });

    it("should return 400 when options violate module schema", async () => {
      const invalidConfig = {maxLimit: "not-a-number"};
      const response = await request.put("/config/bucket", invalidConfig);
      expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
    });

    it("should accept valid data matching different module schemas via anyOf", async () => {
      const bucketConfig = {maxLimit: 200};
      const functionConfig = {timeout: 5000};

      const bucketResponse = await request.put("/config/bucket", bucketConfig);
      expect([bucketResponse.statusCode, bucketResponse.statusText]).toEqual([200, "OK"]);
      expect(bucketResponse.body.options.maxLimit).toBe(200);

      const functionResponse = await request.put("/config/function", functionConfig);
      expect([functionResponse.statusCode, functionResponse.statusText]).toEqual([200, "OK"]);
      expect(functionResponse.body.options.timeout).toBe(5000);
    });
  });
});
