import {Action} from "@spica-server/interface/activity";
import {createPreferenceActivity} from "@spica-server/preference/src/activity.resource";

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
