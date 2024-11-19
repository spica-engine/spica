import {Action} from "@spica/api/src/activity/services";
import {createApikeyActivity} from "@spica/api/src/passport/apikey/src/activity.resource";

describe("Activity Resource", () => {
  it("should return activity from post request", () => {
    const res = {
      _id: "apikey_id"
    };

    const activities = createApikeyActivity(
      {action: Action.POST, identifier: "test_user"},
      {},
      res
    );
    expect(activities).toEqual([
      {action: Action.POST, identifier: "test_user", resource: ["passport", "apikey", "apikey_id"]}
    ]);
  });

  it("should return activity from put request", () => {
    const req = {
      params: {
        id: "apikey_id"
      }
    };

    const activities = createApikeyActivity({action: Action.PUT, identifier: "test_user"}, req, {});
    expect(activities).toEqual([
      {action: Action.PUT, identifier: "test_user", resource: ["passport", "apikey", "apikey_id"]}
    ]);
  });

  it("should return activity from delete request", () => {
    const req = {
      params: {
        id: "apikey_id"
      }
    };

    const activities = createApikeyActivity(
      {action: Action.DELETE, identifier: "test_user"},
      req,
      {}
    );
    expect(activities).toEqual([
      {
        action: Action.DELETE,
        identifier: "test_user",
        resource: ["passport", "apikey", "apikey_id"]
      }
    ]);
  });

  it("should return activity from policy update request", () => {
    const req = {
      params: {
        id: "apikey_id"
      },
      body: ["policy1", "policy2"]
    };

    const activities = createApikeyActivity(
      {action: Action.DELETE, identifier: "test_user"},
      req,
      {}
    );
    expect(activities).toEqual([
      {
        action: Action.DELETE,
        identifier: "test_user",
        resource: ["passport", "apikey", "apikey_id"]
      }
    ]);
  });
});
