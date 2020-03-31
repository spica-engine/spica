import {Test} from "@nestjs/testing";
import {ActivityService, ActivityModule, Action} from "@spica-server/activity";
import {DatabaseTestingModule, DatabaseService} from "@spica-server/database/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {INestApplication} from "@nestjs/common";

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

    //insert identities
    await module
      .get(DatabaseService)
      .collection("identity")
      .insertMany([
        {_id: "test_user_id", identifier: "test_user"},
        {_id: "test_user_id2", identifier: "test_user2"}
      ]);

    jasmine.addCustomEqualityTester((actual, expected) => {
      if (expected == "object_id" && typeof actual == typeof expected) {
        return true;
      }
    });
  });

  afterEach(async () => {
    await service.deleteMany({});
  });

  function objectIdToDate(id: string): string {
    return new Date(parseInt(id.substring(0, 8), 16) * 1000).toISOString();
  }

  it("should return all activities", async () => {
    await service.insertMany([
      {
        action: Action.DELETE,
        identifier: "test_user_id",
        resource: {name: "test_module", documentId: ["test_id"]}
      },
      {
        action: Action.POST,
        identifier: "test_user_id2",
        resource: {name: "test_module2", documentId: ["test_id2"]}
      }
    ]);

    const {body: activities} = await request.get("/activity", {});
    expect(activities).toEqual([
      {
        _id: "object_id",
        action: Action.DELETE,
        identifier: "test_user",
        resource: {name: "test_module", documentId: ["test_id"]},
        date: objectIdToDate(activities[0]._id)
      },
      {
        _id: "object_id",
        action: Action.POST,
        identifier: "test_user2",
        resource: {name: "test_module2", documentId: ["test_id2"]},
        date: objectIdToDate(activities[1]._id)
      }
    ]);
  });

  it("should filter activities by identifier", async () => {
    await service.insertMany([
      {
        action: Action.DELETE,
        identifier: "test_user_id",
        resource: {name: "test_module", documentId: ["test_id"]}
      },
      {
        action: Action.POST,
        identifier: "test_user_id2",
        resource: {name: "test_module2", documentId: ["test_id2"]}
      }
    ]);

    const {body: activities} = await request.get("/activity", {identifier: "test_user"});
    expect(activities).toEqual([
      {
        _id: "object_id",
        action: Action.DELETE,
        identifier: "test_user",
        resource: {name: "test_module", documentId: ["test_id"]},
        date: objectIdToDate(activities[0]._id)
      }
    ]);
  });

  it("should filter activities by action", async () => {
    await service.insertMany([
      {
        action: Action.DELETE,
        identifier: "test_user_id",
        resource: {name: "test_module", documentId: ["test_id"]}
      },
      {
        action: Action.POST,
        identifier: "test_user_id2",
        resource: {name: "test_module2", documentId: ["test_id2"]}
      }
    ]);

    const {body: activities} = await request.get("/activity", {action: Action.POST});
    expect(activities).toEqual([
      {
        _id: "object_id",
        action: Action.POST,
        identifier: "test_user2",
        resource: {name: "test_module2", documentId: ["test_id2"]},
        date: objectIdToDate(activities[0]._id)
      }
    ]);
  });

  it("should filter activities by multiple actions", async () => {
    await service.insertMany([
      {
        action: Action.DELETE,
        identifier: "test_user_id",
        resource: {name: "test_module", documentId: ["test_id"]}
      },
      {
        action: Action.POST,
        identifier: "test_user_id2",
        resource: {name: "test_module2", documentId: ["test_id2"]}
      },
      {
        action: Action.PUT,
        identifier: "test_user_id2",
        resource: {name: "test_module2", documentId: ["test_id2"]}
      }
    ]);

    const {body: activities} = await request.get("/activity", {
      action: [Action.POST, Action.DELETE]
    });
    expect(activities).toEqual([
      {
        _id: "object_id",
        action: Action.DELETE,
        identifier: "test_user",
        resource: {name: "test_module", documentId: ["test_id"]},
        date: objectIdToDate(activities[0]._id)
      },
      {
        _id: "object_id",
        action: Action.POST,
        identifier: "test_user2",
        resource: {name: "test_module2", documentId: ["test_id2"]},
        date: objectIdToDate(activities[1]._id)
      }
    ]);
  });

  it("should filter activities by module name and document ID", async () => {
    await service.insertMany([
      {
        action: Action.DELETE,
        identifier: "test_user_id",
        resource: {name: "test_module", documentId: ["test_id3"]}
      },
      {
        action: Action.POST,
        identifier: "test_user_id",
        resource: {name: "test_module2", documentId: ["test_id3"]}
      },
      {
        action: Action.PUT,
        identifier: "test_user_id",
        resource: {name: "test_module2", documentId: ["test_id3", "test_id123"]}
      }
    ]);

    const {body: activities} = await request.get("/activity", {
      resource: {name: "test_module2", documentId: ["test_id3"]}
    });
    expect(activities).toEqual([
      {
        _id: "object_id",
        action: Action.POST,
        identifier: "test_user",
        resource: {name: "test_module2", documentId: ["test_id3"]},
        date: objectIdToDate(activities[0]._id)
      },
      {
        _id: "object_id",
        action: Action.PUT,
        identifier: "test_user",
        resource: {name: "test_module2", documentId: ["test_id3", "test_id123"]},
        date: objectIdToDate(activities[0]._id)
      }
    ]);
  });

  it("should skip and limit", async () => {
    await service.insertMany([
      {
        action: Action.DELETE,
        identifier: "test_user_id",
        resource: {name: "test_module", documentId: ["test_id3"]}
      },
      {
        action: Action.POST,
        identifier: "test_user_id",
        resource: {name: "test_module2", documentId: ["test_id3"]}
      },
      {
        action: Action.PUT,
        identifier: "test_user_id",
        resource: {name: "test_module2", documentId: ["test_id3", "test_id123"]}
      }
    ]);

    const {body: activities} = await request.get("/activity", {
      skip: 1,
      limit: 1
    });
    expect(activities).toEqual([
      {
        _id: "object_id",
        action: Action.POST,
        identifier: "test_user",
        resource: {name: "test_module2", documentId: ["test_id3"]},
        date: objectIdToDate(activities[0]._id)
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
