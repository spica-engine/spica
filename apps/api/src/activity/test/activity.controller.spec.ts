import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {ActivityModule} from "@spica/api/src/activity";
import {Action, ActivityService} from "@spica/api/src/activity/services";
import {CoreTestingModule, Request} from "@spica/core";
import {DatabaseService, DatabaseTestingModule, ObjectId} from "@spica/database";
import {PassportTestingModule} from "@spica/api/src/passport/testing";

describe("Activity Acceptance", () => {
  let request: Request;
  let app: INestApplication;
  let service: ActivityService;
  let created_at: Date;

  let user1Id;
  let user2Id;

  let insertedActivityIds = [];

  beforeEach(async () => {
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
      .insertMany([{identifier: "user1"}, {identifier: "user2"}])
      .then(res => {
        user1Id = res.insertedIds[0];
        user2Id = res.insertedIds[1];
      });

    jasmine.addCustomEqualityTester((actual, expected) => {
      if (expected == "object_id" && typeof actual == typeof expected && ObjectId.isValid(actual)) {
        return true;
      }
    });

    jasmine.addCustomEqualityTester((actual, expected) => {
      if (
        expected == "created_at" &&
        typeof actual == typeof expected &&
        typeof new Date(actual).getTime() == "number"
      ) {
        return true;
      }
    });

    insertedActivityIds = await service.insert([
      {
        action: Action.DELETE,
        identifier: user1Id.toString(),
        resource: ["test_module", "test_id1"]
      },
      {
        action: Action.POST,
        identifier: user2Id.toString(),
        resource: ["test_module", "test_id2"]
      },
      {
        action: Action.PUT,
        identifier: user2Id.toString(),
        resource: ["test_module", "test_id3"]
      }
    ]);
  });

  afterEach(async () => {
    await app.close();
  });

  it("should return all activities", async () => {
    const {body: activities} = await request.get("/activity", {});
    expect(activities).toEqual([
      {
        _id: "object_id",
        action: Action.PUT,
        identifier: "user2",
        resource: ["test_module", "test_id3"],
        created_at: "created_at"
      },
      {
        _id: "object_id",
        action: Action.POST,
        identifier: "user2",
        resource: ["test_module", "test_id2"],
        created_at: "created_at"
      },
      {
        _id: "object_id",
        action: Action.DELETE,
        identifier: "user1",
        resource: ["test_module", "test_id1"],
        created_at: "created_at"
      }
    ]);
  });

  it("should filter activities by identifier", async () => {
    const {body: activities} = await request.get("/activity", {identifier: "user1"});
    expect(activities).toEqual([
      {
        _id: "object_id",
        action: Action.DELETE,
        identifier: "user1",
        resource: ["test_module", "test_id1"],
        created_at: "created_at"
      }
    ]);
  });

  it("should filter activities by action", async () => {
    const {body: activities} = await request.get("/activity", {action: Action.POST});
    expect(activities).toEqual([
      {
        _id: "object_id",
        action: Action.POST,
        identifier: "user2",
        resource: ["test_module", "test_id2"],
        created_at: "created_at"
      }
    ]);
  });

  it("should filter activities by multiple actions", async () => {
    const {body: activities} = await request.get("/activity", {
      action: [Action.POST, Action.DELETE]
    });
    expect(activities).toEqual([
      {
        _id: "object_id",
        action: Action.POST,
        identifier: "user2",
        resource: ["test_module", "test_id2"],
        created_at: "created_at"
      },
      {
        _id: "object_id",
        action: Action.DELETE,
        identifier: "user1",
        resource: ["test_module", "test_id1"],
        created_at: "created_at"
      }
    ]);
  });

  it("should filter activities by resources", async () => {
    const {body: activities} = await request.get("/activity", {
      resource: JSON.stringify({$all: ["test_module"], $in: ["test_id1", "test_id3"]})
    });
    expect(activities).toEqual([
      {
        _id: "object_id",
        action: Action.PUT,
        identifier: "user2",
        resource: ["test_module", "test_id3"],
        created_at: "created_at"
      },
      {
        _id: "object_id",
        action: Action.DELETE,
        identifier: "user1",
        resource: ["test_module", "test_id1"],
        created_at: "created_at"
      }
    ]);
  });

  it("should skip and limit", async () => {
    const {body: activities} = await request.get("/activity", {
      skip: 2,
      limit: 1
    });
    expect(activities).toEqual([
      {
        _id: "object_id",
        action: Action.DELETE,
        identifier: "user1",
        resource: ["test_module", "test_id1"],
        created_at: "created_at"
      }
    ]);
  });

  it("should delete activity", async () => {
    const res = await request.delete(`/activity/${insertedActivityIds[2]}`);
    expect(res.statusCode).toEqual(204);
    expect(res.body).toBeFalsy();

    const {body: activities} = await request.get("/activity");

    expect(activities).toEqual([
      {
        _id: "object_id",
        action: Action.POST,
        identifier: "user2",
        resource: ["test_module", "test_id2"],
        created_at: "created_at"
      },
      {
        _id: "object_id",
        action: Action.DELETE,
        identifier: "user1",
        resource: ["test_module", "test_id1"],
        created_at: "created_at"
      }
    ]);
  });

  it("should delete multiple activities", async () => {
    const res = await request.delete("/activity", insertedActivityIds);
    expect(res.statusCode).toEqual(204);
    expect(res.body).toBeFalsy();

    const {body: activities} = await request.get("/activity");

    expect(activities).toEqual([]);
  });
});
