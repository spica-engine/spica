import {ActionDispatcher} from "../../src";
import {actionKey} from "../../src/dispatcher";

describe("Dispatcher", () => {
  let actionDispatcher: ActionDispatcher;
  beforeEach(() => {
    actionDispatcher = new ActionDispatcher();
  });

  afterEach(() => {
    actionDispatcher.removeAllListeners();
  });

  it("should return actionKey", () => {
    expect(actionKey("test_bucket", "GET")).toEqual("test_bucket_GET");
  });

  it("should emit given parameters to listener", () => {
    actionDispatcher.on("test_bucket_GET", () => {});

    const emitSpy = spyOn(actionDispatcher, "emit");

    actionDispatcher.dispatch(
      {bucket: "test_bucket", type: "GET"},
      {
        authorization: "APIKEY 12345",
        strategy: "APIKEY"
      }
    );

    expect(emitSpy).toHaveBeenCalledTimes(1);

    expect(typeof emitSpy.calls.first().args[1]).toEqual("function");

    expect([emitSpy.calls.first().args[0], emitSpy.calls.first().args[2]]).toEqual([
      "test_bucket_GET",
      {
        authorization: "APIKEY 12345",
        strategy: "APIKEY"
      }
    ]);
  });

  it("should resolve promise false if there is no listeners for that action", () => {
    actionDispatcher
      .dispatch(
        {bucket: "test_bucket", type: "GET"},
        {
          authorization: "APIKEY 12345",
          strategy: "APIKEY"
        }
      )
      .then(result => expect(result).toBe(false));
  });
});
