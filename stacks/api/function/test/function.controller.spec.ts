import {BadRequestException} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {FunctionEngine} from "@spica-server/function/src/engine";
import {FunctionController} from "@spica-server/function/src/function.controller";
import {FunctionService} from "@spica-server/function/src/function.service";

describe("FunctionController", () => {
  let controller: FunctionController;
  let module: TestingModule;
  let functionService: FunctionService;
  let functionEngine: jasmine.SpyObj<FunctionEngine>;
  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.standalone()],
      providers: [FunctionService]
    }).compile();
    functionService = module.get(FunctionService);
    functionEngine = jasmine.createSpyObj<FunctionEngine>("engine", [
      "createFunction",
      "categorizeChanges"
    ]);
    controller = new FunctionController(functionService, functionEngine, undefined, {
      root: "",
      timeout: 60,
      runtime: {
        discoveryRoot: "./stacks/api/function/runtimes",
        default: {
          name: "node",
          version: "12.19.0"
        }
      }
    });
  });

  afterEach(async () => await functionService.deleteMany({}));

  afterAll(async () => await module.close());

  it("should fail if the inserted function has bucket triggers with same configuration", async () => {
    const result = await controller
      .insertOne({
        triggers: {
          default: {
            type: "bucket",
            options: {
              bucket: "test",
              phase: "BEFORE",
              type: "GET"
            }
          },
          default1: {
            type: "bucket",
            options: {
              bucket: "test",
              phase: "BEFORE",
              type: "GET"
            }
          }
        },
        env: {},
        timeout: 60,
        language: "javascript"
      })
      .catch(e => e);
    expect(result instanceof BadRequestException).toBe(true);
    expect(result.message).toBe(
      "Multiple handlers on same bucket and event type in before phase are not supported."
    );
  });

  it("should fail if the inserted function has bucket triggers with same configuration in database", async () => {
    await controller.insertOne({
      triggers: {
        default: {
          type: "bucket",
          options: {
            bucket: "test",
            phase: "BEFORE",
            type: "GET"
          }
        }
      },
      env: {},
      timeout: 60,
      language: "javascript"
    });
    const result = await controller
      .insertOne({
        triggers: {
          default: {
            type: "bucket",
            options: {
              bucket: "test",
              phase: "BEFORE",
              type: "GET"
            }
          }
        },
        env: {},
        timeout: 60,
        language: "javascript"
      })
      .catch(e => e);
    expect(result instanceof BadRequestException).toBe(true);
    expect(result.message).toBe(
      "Multiple handlers on same bucket and event type in before phase are not supported."
    );
  });

  it("should fail if the updated function has bucket triggers with same configuration", async () => {
    const fn = await controller.insertOne({
      triggers: {},
      env: {},
      timeout: 60,
      language: "javascript"
    });
    const result = await controller
      .replaceOne(fn._id as ObjectId, {
        triggers: {
          default: {
            type: "bucket",
            options: {
              bucket: "test",
              phase: "BEFORE",
              type: "GET"
            }
          },
          default1: {
            type: "bucket",
            options: {
              bucket: "test",
              phase: "BEFORE",
              type: "GET"
            }
          }
        },
        env: {},
        timeout: 60,
        language: "javascript"
      })
      .catch(e => e);
    expect(result instanceof BadRequestException).toBe(true);
    expect(result.message).toBe(
      "Multiple handlers on same bucket and event type in before phase are not supported."
    );
  });

  it("should not fail if the updated function has bucket triggers with same configuration in database", async () => {
    const fn = await controller.insertOne({
      triggers: {
        default: {
          type: "bucket",
          options: {
            bucket: "test",
            phase: "BEFORE",
            type: "GET"
          }
        }
      },
      env: {},
      timeout: 60,
      language: "javascript"
    });

    await expectAsync(
      controller.replaceOne(fn._id as ObjectId, {
        triggers: {
          default: {
            type: "bucket",
            options: {
              bucket: "test",
              phase: "BEFORE",
              type: "GET"
            }
          }
        },
        env: {},
        timeout: 60,
        language: "javascript"
      })
    ).toBeResolved();
  });
});
