import {BadRequestException} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {FunctionController} from "@spica-server/function/src/function.controller";
import {FunctionService} from "@spica-server/function/src/function.service";

describe("FunctionController", () => {
  let controller: FunctionController;
  let module: TestingModule;
  let functionService: FunctionService;
  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.create()],
      providers: [FunctionService]
    }).compile();
    functionService = module.get(FunctionService);
    controller = new FunctionController(functionService, undefined, undefined);
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
              type: "GET"
            }
          },
          default1: {
            type: "bucket",
            options: {
              bucket: "test",
              type: "GET"
            }
          }
        }
      })
      .catch(e => e);
    expect(result instanceof BadRequestException).toBe(true);
    expect(result.message.message).toBe(
      "Multiple handlers on same bucket and event type are not supported."
    );
  });

  it("should fail if the inserted function has bucket triggers with same configuration in database", async () => {
    await controller.insertOne({
      triggers: {
        default: {
          type: "bucket",
          options: {
            bucket: "test",
            type: "GET"
          }
        }
      }
    });
    const result = await controller
      .insertOne({
        triggers: {
          default: {
            type: "bucket",
            options: {
              bucket: "test",
              type: "GET"
            }
          }
        }
      })
      .catch(e => e);
    expect(result instanceof BadRequestException).toBe(true);
    expect(result.message.message).toBe(
      "Multiple handlers on same bucket and event type are not supported."
    );
  });

  it("should fail if the updated function has bucket triggers with same configuration", async () => {
    const fn = await controller.insertOne({triggers: {}});
    const result = await controller
      .updateOne(fn._id as ObjectId, {
        triggers: {
          default: {
            type: "bucket",
            options: {
              bucket: "test",
              type: "GET"
            }
          },
          default1: {
            type: "bucket",
            options: {
              bucket: "test",
              type: "GET"
            }
          }
        }
      })
      .catch(e => e);
    expect(result instanceof BadRequestException).toBe(true);
    expect(result.message.message).toBe(
      "Multiple handlers on same bucket and event type are not supported."
    );
  });

  it("should not fail if the updated function has bucket triggers with same configuration in database", async () => {
    const fn = await controller.insertOne({
      triggers: {
        default: {
          type: "bucket",
          options: {
            bucket: "test",
            type: "GET"
          }
        }
      }
    });

    await expectAsync(
      controller.updateOne(fn._id as ObjectId, {
        triggers: {
          default: {
            type: "bucket",
            options: {
              bucket: "test",
              type: "GET"
            }
          }
        }
      })
    ).toBeResolved();
  });
});
