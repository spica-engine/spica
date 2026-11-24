import {allowPlaceholders} from "@spica-server/function/src/schema/placeholder-schema";

const WHOLE_PLACEHOLDER_PATTERN = "^\\$\\{(SECRET|ENV)\\.([^{}\\s]+)\\}$";

describe("allowPlaceholders", () => {
  it("should accept a whole placeholder in place of a number", () => {
    const schema = {properties: {port: {type: "number", minimum: 1}}};

    expect(allowPlaceholders(schema)).toEqual({
      properties: {
        port: {type: ["number", "string"], minimum: 1, pattern: WHOLE_PLACEHOLDER_PATTERN}
      }
    });
  });

  it("should accept a whole placeholder in place of an integer or a boolean", () => {
    const schema = {properties: {retries: {type: "integer"}, tls: {type: "boolean"}}};

    expect(allowPlaceholders(schema)).toEqual({
      properties: {
        retries: {type: ["integer", "string"], pattern: WHOLE_PLACEHOLDER_PATTERN},
        tls: {type: ["boolean", "string"], pattern: WHOLE_PLACEHOLDER_PATTERN}
      }
    });
  });

  it("should keep default and description untouched", () => {
    const schema = {properties: {port: {type: "number", default: 5, description: "Port"}}};

    expect(allowPlaceholders(schema)).toEqual({
      properties: {
        port: {
          type: ["number", "string"],
          default: 5,
          description: "Port",
          pattern: WHOLE_PLACEHOLDER_PATTERN
        }
      }
    });
  });

  it("should leave string properties untouched", () => {
    const schema = {properties: {url: {type: "string", format: "uri"}}};

    expect(allowPlaceholders(schema)).toEqual(schema);
  });

  it("should leave enumerated properties untouched", () => {
    const schema = {properties: {level: {type: "integer", enum: [1, 2]}}};

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
          properties: {
            retries: {type: ["integer", "string"], pattern: WHOLE_PLACEHOLDER_PATTERN}
          }
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
