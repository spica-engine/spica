import {Action} from "@spica-server/activity";
import {createStorageResource} from "./activity.resource";

describe("Activity Resource", () => {
  it("should return activity from post request", () => {
    const res = [{_id: "storage_object1"}, {_id: "storage_object2"}];
    const action = Action.POST;

    const resource = createStorageResource(action, {}, res);
    expect(resource).toEqual({
      name: "STORAGE",
      documentId: ["storage_object1", "storage_object2"]
    });
  });

  it("should return activity from put request", () => {
    const req = {
      params: {
        id: "storage_object"
      }
    };
    const action = Action.PUT;

    const resource = createStorageResource(action, req, {});
    expect(resource).toEqual({
      name: "STORAGE",
      documentId: ["storage_object"]
    });
  });

  it("should return activity from delete request", () => {
    const req = {
      params: {
        id: "storage_object"
      }
    };
    const action = Action.DELETE;

    const resource = createStorageResource(action, req, {});
    expect(resource).toEqual({
      name: "STORAGE",
      documentId: ["storage_object"]
    });
  });
});
