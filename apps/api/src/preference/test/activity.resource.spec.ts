import {Action} from "@spica/api/src/activity/services";
import {createPreferenceActivity} from "@spica/api/src/preference/src/activity.resource";

describe("Activity Resource", () => {
  it("should return activity", () => {
    const req = {
      params: {
        scope: "test_scope"
      }
    };

    const activities = createPreferenceActivity(
      {action: Action.PUT, identifier: "test_user"},
      req,
      {}
    );
    expect(activities).toEqual([
      {action: Action.PUT, identifier: "test_user", resource: ["preference", "test_scope"]}
    ]);
  });
});
