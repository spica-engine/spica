import {Action} from "@spica-server/activity/services";
import {createPreferenceResource} from "@spica-server/preference/src/activity.resource";

describe("Activity Resource", () => {
  it("should return activity", () => {
    const req = {
      params: {
        scope: "test_scope"
      }
    };
    const action = Action.PUT;

    const resource = createPreferenceResource(action, req, {});
    expect(resource).toEqual(["preference","test_scope"]);
  });
});
