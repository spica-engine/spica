import {Action} from "@spica-server/activity/services";
import {createStorageActivity} from "@spica-server/storage/src/activity.resource";

describe("Activity Resource", () => {
  it("should return activity from post request", () => {
    const res = [{_id: "storage_object1"}, {_id: "storage_object2"}];

    const activities = createStorageActivity(
      {action: Action.POST, identifier: "test_identifier"},
      {},
      res
    );
    expect(activities).toEqual([
      {
        action: Action.POST,
        identifier: "test_identifier",
        resource: ["storage", "storage_object1"]
      },
      {
        action: Action.POST,
        identifier: "test_identifier",
        resource: ["storage", "storage_object2"]
      }
    ]);
  });

  it("should return activity from put request", () => {
    const req = {
      params: {
        id: "storage_object"
      }
    };

    const activities = createStorageActivity(
      {action: Action.PUT, identifier: "test_identifier"},
      req,
      {}
    );
    expect(activities).toEqual([
      {action: Action.PUT, identifier: "test_identifier", resource: ["storage", "storage_object"]}
    ]);
  });

  it("should return activity from delete request", () => {
    const req = {
      params: {
        id: "storage_object"
      }
    };

    const activities = createStorageActivity(
      {action: Action.DELETE, identifier: "test_identifier"},
      req,
      {}
    );
    expect(activities).toEqual([
      {
        action: Action.DELETE,
        identifier: "test_identifier",
        resource: ["storage", "storage_object"]
      }
    ]);
  });
});
