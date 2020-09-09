import {ReviewDispatcher, reviewKey} from "@spica-server/bucket/hooks/src/dispatcher";

describe("Review Dispatcher", () => {
  let reviewDispatcher: ReviewDispatcher;
  beforeEach(() => {
    reviewDispatcher = new ReviewDispatcher();
  });

  afterEach(() => {
    reviewDispatcher.removeAllListeners();
  });

  it("should return an actionKey", () => {
    expect(reviewKey("test_bucket", "GET")).toEqual("test_bucket_GET");
  });

  it("should emit given parameters to listener", () => {
    reviewDispatcher.on("test_bucket_GET", () => {});

    const emitSpy = spyOn(reviewDispatcher, "emit");

    reviewDispatcher.dispatch(
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

  it("should resolve the promise to false if there is no listeners for the arbitrary review", () => {
    reviewDispatcher
      .dispatch(
        {bucket: "test_bucket", type: "GET"},
        {
          authorization: "APIKEY 12345",
          strategy: "APIKEY"
        }
      )
      .then(result => expect(result).toBe(true));
  });
});
