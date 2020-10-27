import {InputResolver} from "./input.resolver";

describe("InputResolver", () => {
  it("should return empty array", () => {
    const resolver = new InputResolver([]);
    expect(resolver.entries()).toEqual([]);
  });

  it("should return types", () => {
    const resolver = new InputResolver([
      {
        color: "#fff",
        icon: "format_quote",
        origin: "string",
        type: "mytype",
        placer: undefined
      }
    ]);
    expect(resolver.entries()).toEqual(["mytype"]);
  });

  it("should return type", () => {
    class FakePlacer {}
    const resolver = new InputResolver([
      {
        color: "#fff",
        icon: "format_qoute",
        origin: "string",
        type: "mytype",
        placer: FakePlacer
      }
    ]);
    expect(resolver.resolve("mytype2")).toBe(undefined);
    expect(resolver.resolve("mytype")).toEqual({
      color: "#fff",
      icon: "format_qoute",
      origin: "string",
      type: "mytype",
      placer: FakePlacer
    });
  });

  it("should return type origin", () => {
    const resolver = new InputResolver([
      {
        color: "#fff",
        icon: "format_qoute",
        origin: "string",
        type: "mytype",
        placer: undefined
      }
    ]);
    expect(resolver.getOriginByType("mytype")).toBe("string");
  });

  it("should call coerce function", () => {
    const coerceSpy = jasmine.createSpy().and.returnValue({test: 123});
    const resolver = new InputResolver([
      {
        color: "#fff",
        icon: "format_qoute",
        origin: "string",
        type: "mytype",
        placer: undefined,
        coerce: coerceSpy
      }
    ]);
    expect(resolver.coerce("mytype")).toEqual({test: 123});
    expect(coerceSpy).toHaveBeenCalledTimes(1);
  });

  it("should return if the type has no coerce fn", () => {
    const resolver = new InputResolver([
      {
        color: "#fff",
        icon: "format_qoute",
        origin: "string",
        type: "mytype",
        placer: undefined
      }
    ]);
    expect(resolver.coerce("mytype")).toBeUndefined();
  });
});
