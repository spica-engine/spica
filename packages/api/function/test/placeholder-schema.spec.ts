import {allowPlaceholders} from "@spica-server/function/src/schema/placeholder-schema";

const WHOLE_PLACEHOLDER = {
  type: "string",
  pattern: "^\\$\\{(SECRET|ENV)\\.([^{}\\s]+)\\}$"
};

describe("allowPlaceholders", () => {
  it("should accept a whole placeholder in place of a number", () => {
    const schema = {properties: {port: {type: "number", minimum: 1}}};

    expect(allowPlaceholders(schema)).toEqual({
      properties: {
        port: {oneOf: [{type: "number", minimum: 1}, WHOLE_PLACEHOLDER]}
      }
    });
  });

  it("should accept a whole placeholder in place of an integer or a boolean", () => {
    const schema = {properties: {retries: {type: "integer"}, tls: {type: "boolean"}}};

    expect(allowPlaceholders(schema)).toEqual({
      properties: {
        retries: {oneOf: [{type: "integer"}, WHOLE_PLACEHOLDER]},
        tls: {oneOf: [{type: "boolean"}, WHOLE_PLACEHOLDER]}
      }
    });
  });

  it("should keep default, description and title outside of oneOf", () => {
    const schema = {
      properties: {port: {type: "number", default: 5, description: "Port", title: "Port"}}
    };

    expect(allowPlaceholders(schema)).toEqual({
      properties: {
        port: {
          default: 5,
          description: "Port",
          title: "Port",
          oneOf: [{type: "number"}, WHOLE_PLACEHOLDER]
        }
      }
    });
  });

  it("should leave string properties untouched", () => {
    const schema = {properties: {url: {type: "string", format: "uri"}}};

    expect(allowPlaceholders(schema)).toEqual(schema);
  });

  it("should relax properties of nested objects", () => {
    const schema = {
      properties: {
        connection: {type: "object", properties: {retries: {type: "integer"}}}
      }
    };

    expect(allowPlaceholders(schema)).toEqual({
      properties: {
        connection: {
          type: "object",
          properties: {retries: {oneOf: [{type: "integer"}, WHOLE_PLACEHOLDER]}}
        }
      }
    });
  });

  it("should not mutate the given schema", () => {
    const schema = {properties: {port: {type: "number"}}};

    allowPlaceholders(schema);

    expect(schema).toEqual({properties: {port: {type: "number"}}});
  });
});
