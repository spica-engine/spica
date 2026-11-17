import * as Storage from "../";

describe("@spica-devkit/storage ids", () => {
  it("should export idOf for both record shapes", () => {
    expect(Storage.idOf({_id: "m1", name: "a"})).toBe("m1");
    expect(Storage.idOf({id: "p1", name: "a"})).toBe("p1");
  });
});
