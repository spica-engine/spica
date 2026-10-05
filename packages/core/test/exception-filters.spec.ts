import {describe, expect, it, jest} from "@jest/globals";
import {ArgumentsHost, HttpException} from "@nestjs/common";
import {DriverCapabilityExceptionFilter, driverErrorStatus} from "@spica-server/core";

/**
 * The filter's job is to stop "this backend cannot do that" from looking like a crash. Both driver
 * error classes carry a `code`, and matching on it rather than `instanceof` is deliberate — a second module
 * instance of the class would break the check while the error kept flowing, the same trap `isId()` exists
 * for.
 */
const capabilityError = () =>
  Object.assign(new Error("'system.profile' is not available on the postgres backend."), {
    code: "UNSUPPORTED_CAPABILITY"
  });

const expressionError = () =>
  Object.assign(new Error("This expression is not supported: filter operator '$where'"), {
    code: "UNSUPPORTED_EXPRESSION"
  });

const httpHost = (): ArgumentsHost =>
  ({
    getType: () => "http",
    switchToHttp: () => ({
      getResponse: () => ({status: jest.fn()}),
      getRequest: () => ({url: "/x"})
    })
  }) as any;

const wsHost = (): ArgumentsHost => ({getType: () => "ws"}) as any;

describe("driverErrorStatus", () => {
  it("maps a capability gap to 501 — the server does not implement it", () => {
    expect(driverErrorStatus(capabilityError())).toBe(501);
  });

  it("maps a refused expression to 400 — the caller can fix it", () => {
    expect(driverErrorStatus(expressionError())).toBe(400);
  });

  it("claims nothing else", () => {
    expect(driverErrorStatus(new Error("boom"))).toBeUndefined();
    expect(driverErrorStatus(undefined)).toBeUndefined();
    expect(driverErrorStatus({code: "SCHEMA_LOCK_TIMEOUT"})).toBeUndefined();
  });
});

describe("DriverCapabilityExceptionFilter", () => {
  function build() {
    const filter = new DriverCapabilityExceptionFilter({} as any);
    const delegated: unknown[] = [];
    // `super.catch` is what preserves the previous behaviour for everything this filter does not claim;
    // stubbing it is how we can tell "handled here" from "passed through".
    jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(filter)) as any, "catch")
      .mockImplementation((exception: unknown) => {
        delegated.push(exception);
      });
    return {filter, delegated};
  }

  it("turns a capability gap into a 501 response", () => {
    const {filter, delegated} = build();
    filter.catch(capabilityError(), httpHost());

    expect(delegated.length).toBe(1);
    const sent = delegated[0] as HttpException;
    expect(sent.getStatus()).toBe(501);
    expect(sent.getResponse()).toMatchObject({statusCode: 501, error: "Not Implemented"});
  });

  it("turns a refused expression into a 400 response", () => {
    const {filter, delegated} = build();
    filter.catch(expressionError(), httpHost());

    const sent = delegated[0] as HttpException;
    expect(sent.getStatus()).toBe(400);
    expect(sent.getResponse()).toMatchObject({statusCode: 400, error: "Bad Request"});
  });

  it("passes every other error through untouched", () => {
    const {filter, delegated} = build();
    const original = new Error("boom");
    filter.catch(original, httpHost());

    expect(delegated).toEqual([original]);
  });

  /**
   * A websocket handler has no status code to send, and realtime reports its own refusals through the error
   * chunk — rewriting the exception here would not reach the client.
   */
  it("leaves non-http contexts alone", () => {
    const {filter, delegated} = build();
    const original = capabilityError();
    filter.catch(original, wsHost());

    expect(delegated).toEqual([original]);
  });
});
