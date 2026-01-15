import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {OBJECT_ID} from "@spica-server/core/schema/formats";
import {ConfigModule} from "../src/config.module";
import {ConfigService} from "../src/config.service";
import {ObjectId} from "@spica-devkit/database";

describe("ConfigController", () => {
  let request: Request;
  let app: INestApplication;
  let configService: ConfigService;

  const bucketId = new ObjectId();
  const functionId = new ObjectId();
  const bucketConfig = {
    _id: bucketId,
    module: "bucket",
    options: {
      maxLimit: 100,
      enableCache: true
    }
  };

  const functionConfig = {
    _id: functionId,
    module: "function",
    options: {
      timeout: 30000,
      maxMemory: 512
    }
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        CoreTestingModule,
        PassportTestingModule.initialize(),
        ConfigModule.forRoot(),
        DatabaseTestingModule.standalone(),
        SchemaModule.forRoot({
          formats: [OBJECT_ID]
        })
      ]
    }).compile();

    request = module.get(Request);
    configService = module.get(ConfigService);

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
      await configService.insertOne(bucketConfig);
      await configService.insertOne(functionConfig);

      const response = await request.get("/config");

      expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toEqual({
        _id: bucketId.toString(),
        module: "bucket",
        options: {
          maxLimit: 100,
          enableCache: true
        }
      });
      expect(response.body[1]).toEqual({
        _id: functionId.toString(),
        module: "function",
        options: {
          timeout: 30000,
          maxMemory: 512
        }
      });
    });
  });

  describe("GET /config/:module", () => {
    it("should return undefined response when config does not exist", async () => {
      const response = await request.get("/config/nonexistent");

      expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
      expect(response.body).toBeUndefined();
    });

    it("should get the correct config when multiple configs exist", async () => {
      await configService.insertOne(bucketConfig);
      await configService.insertOne(functionConfig);

      const response = await request.get("/config/function");

      expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
      expect(response.body).toEqual({
        _id: functionId.toString(),
        module: "function",
        options: {
          timeout: 30000,
          maxMemory: 512
        }
      });
    });
  });

  describe("PUT /config/:module", () => {
    it("should update an existing config", async () => {
      await configService.insertOne(bucketConfig);

      const updatedConfig = {
        module: "bucket",
        options: {
          maxLimit: 200,
          enableCache: false
        }
      };

      const response = await request.put("/config/bucket", updatedConfig);

      expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
      expect(response.body).toEqual({
        _id: bucketId.toString(),
        module: "bucket",
        options: {
          maxLimit: 200,
          enableCache: false
        }
      });

      const getResponse = await request.get("/config/bucket");
      expect(getResponse.body.options.maxLimit).toBe(200);
      expect(getResponse.body.options.enableCache).toBe(false);
    });

    it("should replace entire config on update", async () => {
      await configService.insertOne(bucketConfig);

      const partialUpdate = {
        module: "bucket",
        options: {
          maxLimit: 150
        }
      };

      const response = await request.put("/config/bucket", partialUpdate);

      expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
      expect(response.body).toEqual({
        _id: bucketId.toString(),
        module: "bucket",
        options: {
          maxLimit: 150
        }
      });

      const getResponse = await request.get("/config/bucket");
      expect(getResponse.body.options.enableCache).toBeUndefined();
    });

    it("should return undefined when updating non-existent config", async () => {
      const newConfig = {
        module: "nonexistent",
        options: {
          someSetting: true
        }
      };

      const response = await request.put("/config/nonexistent", newConfig);

      expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
      expect(response.body).toBeUndefined();
    });
  });
});
