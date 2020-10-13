import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {ActivityModule} from "@spica-server/activity";
import {Action, ActivityService} from "@spica-server/activity/services";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseService, DatabaseTestingModule} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";

describe("Activity Acceptance", () => {
  let request: Request;
  let app: INestApplication;
  let service: ActivityService;
  let created_at: Date;
  beforeAll(async () => {
    created_at = new Date();
    const module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.create(),
        CoreTestingModule,
        PassportTestingModule.initialize(),
        ActivityModule.forRoot({expireAfterSeconds: 60})
      ]
    }).compile();

    request = module.get(Request);

    app = module.createNestApplication();

    await app.listen(request.socket);

    service = app.get(ActivityService);

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

  it("should return all activities", async () => {
    await service.insertMany([
      {
        action: Action.DELETE,
        identifier: "test_user_id",
        resource: ["test_module", "test_id"],
        created_at
      },
      {
        action: Action.POST,
        identifier: "test_user_id2",
        resource: ["test_module", "test_id"],
        created_at
      }
    ]);

    const {body: activities} = await request.get("/activity", {});
    expect(activities).toEqual([
      {
        _id: "object_id",
        action: Action.POST,
        identifier: "test_user2",
        resource: ["test_module", "test_id"],
        created_at: created_at.toISOString()
      },
      {
        _id: "object_id",
        action: Action.DELETE,
        identifier: "test_user",
        resource: ["test_module", "test_id"],
        created_at: created_at.toISOString()
      }
    ]);
  });

  it("should filter activities by identifier", async () => {
    await service.insertMany([
      {
        action: Action.DELETE,
        identifier: "test_user_id",
        resource: ["test_module", "test_id"],
        created_at
      },
      {
        action: Action.POST,
        identifier: "test_user_id2",
        resource: ["test_module", "test_id"],
        created_at
      }
    ]);

    const {body: activities} = await request.get("/activity", {identifier: "test_user"});
    expect(activities).toEqual([
      {
        _id: "object_id",
        action: Action.DELETE,
        identifier: "test_user",
        resource: ["test_module", "test_id"],
        created_at: created_at.toISOString()
      }
    ]);
  });

  it("should filter activities by action", async () => {
    await service.insertMany([
      {
        action: Action.DELETE,
        identifier: "test_user_id",
        resource: ["test_module", "test_id"],
        created_at
      },
      {
        action: Action.POST,
        identifier: "test_user_id2",
        resource: ["test_module", "test_id"],
        created_at
      }
    ]);

    const {body: activities} = await request.get("/activity", {action: Action.POST});
    expect(activities).toEqual([
      {
        _id: "object_id",
        action: Action.POST,
        identifier: "test_user2",
        resource: ["test_module", "test_id"],
        created_at: created_at.toISOString()
      }
    ]);
  });

  it("should filter activities by multiple actions", async () => {
    await service.insertMany([
      {
        action: Action.DELETE,
        identifier: "test_user_id",
        resource: ["test_module", "test_id"],
        created_at
      },
      {
        action: Action.POST,
        identifier: "test_user_id2",
        resource: ["test_module", "test_id"],
        created_at
      },
      {
        action: Action.PUT,
        identifier: "test_user_id2",
        resource: ["test_module", "test_id"],
        created_at
      }
    ]);

    const {body: activities} = await request.get("/activity", {
      action: [Action.POST, Action.DELETE]
    });
    expect(activities).toEqual([
      {
        _id: "object_id",
        action: Action.POST,
        identifier: "test_user2",
        resource: ["test_module", "test_id"],
        created_at: created_at.toISOString()
      },
      {
        _id: "object_id",
        action: Action.DELETE,
        identifier: "test_user",
        resource: ["test_module", "test_id"],
        created_at: created_at.toISOString()
      }
    ]);
  });

  it("should filter activities by resources", async () => {
    await service.insertMany([
      {
        action: Action.DELETE,
        identifier: "test_user_id",
        resource: ["test_module", "test_id1"],
        created_at
      },
      {
        action: Action.POST,
        identifier: "test_user_id",
        resource: ["test_module2", "test_id2"],
        created_at
      },
      {
        action: Action.DELETE,
        identifier: "test_user_id",
        resource: ["test_module", "test_id3"],
        created_at
      },
      {
        action: Action.DELETE,
        identifier: "test_user_id",
        resource: ["test_module", "test_id4"],
        created_at
      }
    ]);

    const {body: activities} = await request.get("/activity", {
      resource: JSON.stringify({$all: ["test_module"], $in: ["test_id1", "test_id3"]})
    });
    expect(activities).toEqual([
      {
        _id: "object_id",
        action: Action.DELETE,
        identifier: "test_user",
        resource: ["test_module", "test_id3"],
        created_at: created_at.toISOString()
      },
      {
        _id: "object_id",
        action: Action.DELETE,
        identifier: "test_user",
        resource: ["test_module", "test_id1"],
        created_at: created_at.toISOString()
      }
    ]);
  });

  it("should skip and limit", async () => {
    await service.insertMany([
      {
        action: Action.DELETE,
        identifier: "test_user_id",
        resource: ["test_module", "test_id"],
        created_at
      },
      {
        action: Action.POST,
        identifier: "test_user_id",
        resource: ["test_module", "test_id"],
        created_at
      },
      {
        action: Action.PUT,
        identifier: "test_user_id",
        resource: ["test_module", "test_id"],
        created_at
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
        resource: ["test_module", "test_id"],
        created_at: created_at.toISOString()
      }
    ]);
  });

  it("should delete activity", async () => {
    const insertedIds = await service.insertMany([
      {
        action: Action.PUT,
        identifier: "spica",
        resource: ["test_module", "test_id"],
        created_at
      },
      {
        action: Action.POST,
        identifier: "spica",
        resource: ["test_module", "test_id"],
        created_at
      }
    ]);

    const res = await request.delete(`/activity/${insertedIds[1]}`);
    expect(res.statusCode).toEqual(204);
    expect(res.body).toBeFalsy();

    const activities = await service.find({});

    expect(activities).toEqual([
      {
        _id: insertedIds[0],
        action: Action.PUT,
        identifier: "spica",
        resource: ["test_module", "test_id"],
        created_at
      }
    ]);
  });

  it("should delete multiple activities", async () => {
    const insertedIds = await service.insertMany([
      {
        action: Action.PUT,
        identifier: "spica",
        resource: ["test_module", "test_id"],
        created_at
      },
      {
        action: Action.POST,
        identifier: "spica",
        resource: ["test_module", "test_id"],
        created_at
      }
    ]);

    const res = await request.delete("/activity", insertedIds);
    expect(res.statusCode).toEqual(204);
    expect(res.body).toBeFalsy();

    const activities = await service.find({});

    expect(activities).toEqual([]);
  });

  afterAll(async () => {
    await app.close();
  });
});
