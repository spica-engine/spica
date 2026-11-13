import {Logger} from "@nestjs/common";
import {of} from "rxjs";
import {activity, getUser, getAction} from "@spica-server/activity-services";
import {withId} from "@spica-server/data";

describe("Interceptor Unit Test", () => {
  it("should get action from method", () => {
    expect(getAction("POST")).toEqual(1);
    expect(getAction("PUT")).toEqual(2);
    expect(getAction("DELETE")).toEqual(3);
    expect(getAction("PATCH")).toEqual(4);
    expect(getAction("OPTIONS")).toEqual(undefined);
  });

  it("should get identifier from user object", () => {
    expect(getUser(withId({}, "user_id"))).toEqual("user_id");
    expect(getUser(undefined)).toEqual(undefined);
  });

  describe("when recording fails", () => {
    const record = (insert: jest.Mock) => {
      const Interceptor = activity(() => [{identifier: "u", action: 1, resource: ["a"]}]);
      const interceptor = new Interceptor({insert} as any);
      const context = {switchToHttp: () => ({getRequest: () => ({user: withId({}, "u")})})} as any;
      return new Promise<unknown>(resolve =>
        interceptor.intercept(context, {handle: () => of("response")}).subscribe(resolve)
      );
    };
    const flush = () => new Promise(resolve => setTimeout(resolve));

    it("should answer the request and log the failure instead of throwing", async () => {
      const error = jest.spyOn(Logger.prototype, "error").mockImplementation();
      const insert = jest.fn().mockRejectedValue(new Error("insert failed"));

      await expect(record(insert)).resolves.toBe("response");
      await flush();

      expect(insert).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledWith(expect.stringContaining("insert failed"));
      error.mockRestore();
    });
  });
});
