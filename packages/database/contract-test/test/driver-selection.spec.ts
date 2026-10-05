import {describe, expect, it} from "@jest/globals";
import {backendFromUri} from "@spica-server/database";

/**
 * Driver selection.
 *
 * It lives here because `packages/database` has no jest setup of its own and this package already hosts
 * the database package's contract tests. It needs no container — a pure function.
 *
 * What is really tested is **the absence of a silent default**: falling back to a default backend on an
 * unrecognized scheme would be the easiest way to connect to the wrong database and split the data in
 * two.
 */
describe("backendFromUri", () => {
  it("recognizes the mongodb schemes", () => {
    expect(backendFromUri("mongodb://localhost:27017")).toBe("mongodb");
    expect(backendFromUri("mongodb+srv://cluster.example.com")).toBe("mongodb");
  });

  it("recognizes the postgres schemes", () => {
    expect(backendFromUri("postgres://localhost:5432/spica")).toBe("postgres");
    expect(backendFromUri("postgresql://localhost:5432/spica")).toBe("postgres");
  });

  it("the scheme is case insensitive", () => {
    expect(backendFromUri("MongoDB://localhost:27017")).toBe("mongodb");
    expect(backendFromUri("POSTGRESQL://localhost:5432/spica")).toBe("postgres");
  });

  it("raises on an unrecognized scheme and does NOT fall back to a default", () => {
    expect(() => backendFromUri("mysql://localhost:3306")).toThrow(/Unsupported/);
    expect(() => backendFromUri("mysql://localhost:3306")).toThrow(/'mysql'/);
  });

  it("raises when there is no scheme", () => {
    expect(() => backendFromUri("localhost:27017")).toThrow(/\(missing\)/);
    expect(() => backendFromUri("")).toThrow(/\(missing\)/);
    expect(() => backendFromUri(undefined as any)).toThrow(/\(missing\)/);
  });

  it("the error message lists the accepted schemes", () => {
    // The operator has to learn what to write from the message.
    expect(() => backendFromUri("redis://localhost")).toThrow(/mongodb:\/\//);
    expect(() => backendFromUri("redis://localhost")).toThrow(/postgres:\/\//);
  });
});
