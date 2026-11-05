import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {ActivityModule} from "@spica-server/activity";
import {ActivityService} from "@spica-server/activity-services";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {provideRepository} from "@spica-server/data";
import {contractSuite} from "@spica-server/database-testing";
import {Action} from "@spica-server/interface-activity";
import {ID_TYPES, IdTypes} from "@spica-server/interface-data";
import {
  IDENTITY_OPTIONS,
  IDENTITY_REPOSITORY,
  IdentityRepository
} from "@spica-server/interface-passport-identity";
import {USER_OPTIONS, USER_REPOSITORY, UserRepository} from "@spica-server/interface-passport-user";
import {PassportTestingModule} from "@spica-server/passport-testing";

contractSuite("Activity Acceptance", engine => {
  let request: Request;
  let app: INestApplication;
  let service: ActivityService;
  let created_at: Date;
  let identities: IdentityRepository;
  let users: UserRepository;
  let idTypes: IdTypes;

  let user1Id;
  let user2Id;

  const isActivityId = (id: unknown) => idTypes.forCollection("activity").isValid(id);

  let insertedActivityIds = [];

  beforeEach(async () => {
    created_at = new Date();
    const module = await Test.createTestingModule({
      imports: [
        engine.module(),
        CoreTestingModule,
        PassportTestingModule.initialize(),
        ActivityModule.forRoot({expireAfterSeconds: 60})
      ],
      providers: [
        {provide: IDENTITY_OPTIONS, useValue: {entryLimit: 5}},
        {provide: USER_OPTIONS, useValue: {entryLimit: 5}},
        provideRepository(IDENTITY_REPOSITORY),
        provideRepository(USER_REPOSITORY)
      ]
    }).compile();

    request = module.get(Request);

    app = module.createNestApplication();

    await app.listen(request.socket);

    service = app.get(ActivityService);
    identities = module.get(IDENTITY_REPOSITORY);
    users = module.get(USER_REPOSITORY);
    idTypes = module.get(ID_TYPES);

    user1Id = (await identities.insert({identifier: "user1"} as any))._id;
    user2Id = (await identities.insert({identifier: "user2"} as any))._id;

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

    activities.forEach(activity => {
      expect(isActivityId(activity._id)).toBe(true);
      expect(typeof new Date(activity.created_at).getTime()).toBe("number");
    });

    expect(activities).toEqual([
      {
        _id: activities[0]._id,
        action: Action.PUT,
        identifier: "user2",
        resource: ["test_module", "test_id3"],
        created_at: activities[0].created_at
      },
      {
        _id: activities[1]._id,
        action: Action.POST,
        identifier: "user2",
        resource: ["test_module", "test_id2"],
        created_at: activities[1].created_at
      },
      {
        _id: activities[2]._id,
        action: Action.DELETE,
        identifier: "user1",
        resource: ["test_module", "test_id1"],
        created_at: activities[2].created_at
      }
    ]);
  });

  it("should filter activities by identifier", async () => {
    const {body: activities} = await request.get("/activity", {identifier: "user1"});

    activities.forEach(activity => {
      expect(isActivityId(activity._id)).toBe(true);
      expect(typeof new Date(activity.created_at).getTime()).toBe("number");
    });

    expect(activities).toEqual([
      {
        _id: activities[0]._id,
        action: Action.DELETE,
        identifier: "user1",
        resource: ["test_module", "test_id1"],
        created_at: activities[0].created_at
      }
    ]);
  });

  it("should filter activities by action", async () => {
    const {body: activities} = await request.get("/activity", {action: Action.POST});

    activities.forEach(activity => {
      expect(isActivityId(activity._id)).toBe(true);
      expect(typeof new Date(activity.created_at).getTime()).toBe("number");
    });

    expect(activities).toEqual([
      {
        _id: activities[0]._id,
        action: Action.POST,
        identifier: "user2",
        resource: ["test_module", "test_id2"],
        created_at: activities[0].created_at
      }
    ]);
  });

  it("should filter activities by multiple actions", async () => {
    const {body: activities} = await request.get("/activity", {
      action: [Action.POST, Action.DELETE]
    });

    activities.forEach(activity => {
      expect(isActivityId(activity._id)).toBe(true);
      expect(typeof new Date(activity.created_at).getTime()).toBe("number");
    });

    expect(activities).toEqual([
      {
        _id: activities[0]._id,
        action: Action.POST,
        identifier: "user2",
        resource: ["test_module", "test_id2"],
        created_at: activities[0].created_at
      },
      {
        _id: activities[1]._id,
        action: Action.DELETE,
        identifier: "user1",
        resource: ["test_module", "test_id1"],
        created_at: activities[1].created_at
      }
    ]);
  });

  it("should filter activities by resources", async () => {
    const {body: activities} = await request.get("/activity", {
      resource: JSON.stringify({$all: ["test_module"], $in: ["test_id1", "test_id3"]})
    });

    activities.forEach(activity => {
      expect(isActivityId(activity._id)).toBe(true);
      expect(typeof new Date(activity.created_at).getTime()).toBe("number");
    });

    expect(activities).toEqual([
      {
        _id: activities[0]._id,
        action: Action.PUT,
        identifier: "user2",
        resource: ["test_module", "test_id3"],
        created_at: activities[0].created_at
      },
      {
        _id: activities[1]._id,
        action: Action.DELETE,
        identifier: "user1",
        resource: ["test_module", "test_id1"],
        created_at: activities[1].created_at
      }
    ]);
  });

  it("should refuse a resource filter other than $all and $in", async () => {
    const {statusCode} = await request.get("/activity", {
      resource: JSON.stringify({$regex: "test"})
    });

    expect(statusCode).toBe(400);
  });

  it("should skip and limit", async () => {
    const {body: activities} = await request.get("/activity", {
      skip: 2,
      limit: 1
    });

    activities.forEach(activity => {
      expect(isActivityId(activity._id)).toBe(true);
      expect(typeof new Date(activity.created_at).getTime()).toBe("number");
    });

    expect(activities).toEqual([
      {
        _id: activities[0]._id,
        action: Action.DELETE,
        identifier: "user1",
        resource: ["test_module", "test_id1"],
        created_at: activities[0].created_at
      }
    ]);
  });

  it("should delete activity", async () => {
    const res = await request.delete(`/activity/${insertedActivityIds[2]}`);
    expect(res.statusCode).toEqual(204);
    expect(res.body).toBeFalsy();

    const {body: activities} = await request.get("/activity");

    activities.forEach(activity => {
      expect(isActivityId(activity._id)).toBe(true);
      expect(typeof new Date(activity.created_at).getTime()).toBe("number");
    });

    expect(activities).toEqual([
      {
        _id: activities[0]._id,
        action: Action.POST,
        identifier: "user2",
        resource: ["test_module", "test_id2"],
        created_at: activities[0].created_at
      },
      {
        _id: activities[1]._id,
        action: Action.DELETE,
        identifier: "user1",
        resource: ["test_module", "test_id1"],
        created_at: activities[1].created_at
      }
    ]);
  });

  it("should filter activities by username", async () => {
    const testUser1Id = (await users.insert({username: "testuser1"} as any))._id;

    await service.insert([
      {
        action: Action.POST,
        username: testUser1Id.toString(),
        resource: ["test_module", "test_id_username"]
      }
    ]);

    const {body: activities} = await request.get("/activity", {username: "testuser1"});

    activities.forEach(activity => {
      expect(isActivityId(activity._id)).toBe(true);
      expect(typeof new Date(activity.created_at).getTime()).toBe("number");
    });

    expect(activities).toEqual([
      {
        _id: activities[0]._id,
        action: Action.POST,
        username: "testuser1",
        resource: ["test_module", "test_id_username"],
        created_at: activities[0].created_at
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
