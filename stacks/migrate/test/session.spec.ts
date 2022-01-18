import {getSession, setSession} from "@spica/migrate/src/session";

describe("Session", () => {
  it("should return empty session by default", () => {
    expect(getSession()).not.toBeTruthy();
  });

  it("should return the already set session", () => {
    setSession(null);
    expect(getSession()).toBe(null);
  });
});
