import {parser} from "../src/parser";

describe("parser", () => {
  it.each([
    ["parentheses", "(", ")"],
    ["negations", "!(", ")"],
    ["calls", "has(", ")"]
  ])("should parse deeply nested %s in linear time", (_, open, close) => {
    const depth = 200;
    const expression = `${open.repeat(depth)}document.age > 1${close.repeat(depth)}`;

    const start = Date.now();
    parser.parse(expression);

    expect(Date.now() - start).toBeLessThan(1000);
  });

  it("should still parse an expression the same way", () => {
    const tree = parser.parse("document.age > 1 && (document.title == 'a' || !has(document.tags))");

    expect(tree).toMatchObject({kind: "operator", type: "and"});
    expect(tree.right).toMatchObject({kind: "operator", type: "or"});
  });
});
