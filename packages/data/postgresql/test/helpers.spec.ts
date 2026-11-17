import {setPath, unsetPath} from "../src/repositories/helpers.js";

describe("document paths", () => {
  const toStringBefore = Object.prototype.toString;

  afterEach(() => {
    expect(Object.prototype.toString).toBe(toStringBefore);
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
    expect(({} as any).polluted).toBeUndefined();
  });

  it("sets and creates nested paths", () => {
    const target: Record<string, any> = {a: {b: 1}};
    setPath(target, ["a", "c", "d"], 2);
    setPath(target, ["x"], 3);
    expect(target).toEqual({a: {b: 1, c: {d: 2}}, x: 3});
  });

  it("replaces non-object nodes on the way", () => {
    const target: Record<string, any> = {a: "text", b: null};
    setPath(target, ["a", "c"], 1);
    setPath(target, ["b", "c"], 2);
    expect(target).toEqual({a: {c: 1}, b: {c: 2}});
  });

  it("unsets nested paths and ignores missing ones", () => {
    const target: Record<string, any> = {a: {b: 1, c: 2}};
    unsetPath(target, ["a", "b"]);
    unsetPath(target, ["a", "missing", "deep"]);
    unsetPath(target, ["missing"]);
    expect(target).toEqual({a: {c: 2}});
  });

  it("never walks into inherited properties", () => {
    const target: Record<string, any> = {triggers: {}};
    unsetPath(target, ["triggers", "__proto__", "toString"]);
    unsetPath(target, ["constructor", "name"]);
    unsetPath(target, ["triggers", "constructor", "prototype", "toString"]);
    expect(typeof ({} as any).toString).toBe("function");
    expect(typeof Object.prototype.hasOwnProperty).toBe("function");
  });

  it("does not write through inherited properties", () => {
    const target: Record<string, any> = {triggers: {}};
    setPath(target, ["triggers", "__proto__", "polluted"], true);
    setPath(target, ["constructor", "prototype", "polluted"], true);
    expect(target.triggers).toEqual(JSON.parse('{"__proto__":{"polluted":true}}'));
    expect(Object.getPrototypeOf(target.triggers)).toBe(Object.prototype);
  });

  it("treats an own __proto__ key as a plain field", () => {
    const target = JSON.parse('{"triggers":{"__proto__":{"keep":1,"drop":2}}}');
    unsetPath(target, ["triggers", "__proto__", "drop"]);
    expect(target.triggers["__proto__"]).toEqual({keep: 1});
    expect(Object.getPrototypeOf(target.triggers)).toBe(Object.prototype);
  });
});
