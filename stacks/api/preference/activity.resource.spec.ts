import {Action} from "@spica-server/activity/src";
import {createPreferenceResource} from "./activity.resource";

describe("Activity Resource", () => {
  it("should return activity", () => {
    const req = {
      params: {
        scope: "test_scope"
      }
    };
    const action = Action.PUT;

    const resource = createPreferenceResource(action, req, {});
    expect(resource).toEqual({
      name: "PREFERENCE",
      documentId: ["test_scope"]
    });
  });
});
