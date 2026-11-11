import {fieldsOfExpression} from "../../src/realtime/fields.js";

const fields = (expression: string) => {
  const found = fieldsOfExpression(expression);
  return found && [...found].sort();
};

describe("fieldsOfExpression", () => {
  it("should name the document fields a comparison reads", () => {
    expect(fields(`document.age > 20`)).toEqual(["age"]);
  });

  it("should name every side of a logical expression", () => {
    expect(fields(`document.age > 20 && (document.title == "a" || document.done == true)`)).toEqual(
      ["age", "done", "title"]
    );
  });

  it("should name only the top level of a nested path", () => {
    expect(fields(`document.address.city == "Bonn"`)).toEqual(["address"]);
  });

  it("should leave out what comes from the user", () => {
    expect(fields(`document.owner == auth._id`)).toEqual(["owner"]);
    expect(fields(`auth.role == "admin"`)).toEqual([]);
  });

  it("should leave out a rule that reads no field", () => {
    expect(fields(`true==true`)).toEqual([]);
  });

  it("should read the legacy form that names a field without document", () => {
    expect(fields(`title == "second"`)).toEqual(["title"]);
  });

  it("should read the arguments of a function", () => {
    expect(fields(`startsWith(document.label, "h")`)).toEqual(["label"]);
  });

  it("should read a membership test and a conditional", () => {
    expect(fields(`document.status in ["open", "done"]`)).toEqual(["status"]);
    expect(fields(`document.age > 1 ? document.a == 1 : document.b == 2`)).toEqual([
      "a",
      "age",
      "b"
    ]);
  });

  it("should read a negation", () => {
    expect(fields(`!(document.done == true)`)).toEqual(["done"]);
  });

  it.each([`document == 1`, `document.title ==`, ``, `document.tags.some(tag => tag == "a")`])(
    "should not guess for %p",
    expression => {
      expect(fieldsOfExpression(expression)).toBeUndefined();
    }
  );
});
