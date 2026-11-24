import {allowPlaceholders} from "@spica-server/function/src/schema/placeholder-schema";

describe("allowPlaceholders", () => {
  const relaxed = (schema: object) => allowPlaceholders(schema) as any;

  it("should let numeric and boolean properties accept a whole placeholder", () => {
    const {properties} = relaxed({
      properties: {port: {type: "number", minimum: 1, default: 5, description: "d"}, tls: {type: "boolean"}}
    });

    expect(properties.port.default).toEqual(5);
    expect(properties.port.oneOf[0]).toEqual({type: "number", minimum: 1});
    expect(properties.port.oneOf[1].type).toEqual("string");
    expect(properties.tls.oneOf).toHaveLength(2);
  });

  it("should leave string properties untouched", () => {
    const schema = {properties: {url: {type: "string"}}};

    expect(relaxed(schema)).toEqual(schema);
  });

  it("should relax nested properties", () => {
    const {properties} = relaxed({
      properties: {opts: {type: "object", properties: {retries: {type: "integer"}}}}
    });

    expect(properties.opts.properties.retries.oneOf).toHaveLength(2);
  });
});
