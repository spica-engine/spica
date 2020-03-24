import {Test} from "@nestjs/testing";
import {ActivityService} from "../activity.service";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {INestApplication} from "@nestjs/common";
import {ActivityModule} from "../activity.module";
import {Action} from "..";

describe("Activity Acceptance", () => {
  let request: Request;
  let app: INestApplication;
  let service: ActivityService;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.create(), CoreTestingModule, ActivityModule]
    }).compile();

    request = module.get(Request);

    app = module.createNestApplication();

    await app.listen(request.socket);

    service = app.get(ActivityService);

    jasmine.addCustomEqualityTester((actual, expected) => {
      if (expected == "object_id" && typeof actual == typeof expected) {
        return true;
      }
    });
  });

  afterEach(async () => {
    await service.deleteMany({});
  });

  it("should return all activities", async () => {
    await service.insertMany([
      {
        action: Action.DELETE,
        identifier: "spica",
        resource: {name: "test_module", documentId: ["test_id"]}
      },
      {
        action: Action.POST,
        identifier: "spica",
        resource: {name: "test_module2", documentId: ["test_id2"]}
      }
    ]);

    const {body: activites} = await request.get("/activity", {});
    expect(activites).toEqual([
      {
        _id: "object_id",
        action: Action.DELETE,
        identifier: "spica",
        resource: {name: "test_module", documentId: ["test_id"]}
      },
      {
        _id: "object_id",
        action: Action.POST,
        identifier: "spica",
        resource: {name: "test_module2", documentId: ["test_id2"]}
      }
    ]);
  });

  it("should filter activities by identifier", async () => {
    await service.insertMany([
      {
        action: Action.DELETE,
        identifier: "spica",
        resource: {name: "test_module", documentId: ["test_id"]}
      },
      {
        action: Action.POST,
        identifier: "other_identifier",
        resource: {name: "test_module2", documentId: ["test_id2"]}
      }
    ]);

    const {body: activites} = await request.get("/activity", {identifier: "spica"});
    expect(activites).toEqual([
      {
        _id: "object_id",
        action: Action.DELETE,
        identifier: "spica",
        resource: {name: "test_module", documentId: ["test_id"]}
      }
    ]);
  });

  it("should filter activities by action", async () => {
    await service.insertMany([
      {
        action: Action.DELETE,
        identifier: "spica",
        resource: {name: "test_module", documentId: ["test_id"]}
      },
      {
        action: Action.POST,
        identifier: "spica",
        resource: {name: "test_module2", documentId: ["test_id2"]}
      }
    ]);

    const {body: activites} = await request.get("/activity", {action: Action.POST});
    expect(activites).toEqual([
      {
        _id: "object_id",
        action: Action.POST,
        identifier: "spica",
        resource: {name: "test_module2", documentId: ["test_id2"]}
      }
    ]);
  });

  it("should filter activities by module name and document ID", async () => {
    await service.insertMany([
      {
        action: Action.DELETE,
        identifier: "spica",
        resource: {name: "test_module", documentId: ["test_id"]}
      },
      {
        action: Action.POST,
        identifier: "spica",
        resource: {name: "test_module2", documentId: ["test_id2", "test_id5"]}
      },
      {
        action: Action.PUT,
        identifier: "spica",
        resource: {name: "test_module2", documentId: ["test_id3", "test_id123"]}
      }
    ]);

    const {body: activites} = await request.get("/activity", {
      resource: {name: "test_module2", documentId: ["test_id3"]}
    });
    expect(activites).toEqual([
      {
        _id: "object_id",
        action: Action.PUT,
        identifier: "spica",
        resource: {name: "test_module2", documentId: ["test_id3", "test_id123"]}
      }
    ]);
  });

  it("should delete activity", async () => {
    const insertedIds = await service.insertMany([
      {
        action: Action.PUT,
        identifier: "spica",
        resource: {name: "test_module", documentId: ["test_id"]}
      },
      {
        action: Action.POST,
        identifier: "spica",
        resource: {name: "test_module2", documentId: ["test_id2", "test_id5"]}
      }
    ]);

    const res = await request.delete(`/activity/${insertedIds[1]}`);
    expect(res.statusCode).toEqual(204);
    expect(res.body).toEqual(undefined);
  });

  afterAll(async () => {
    await app.close();
  });
});
