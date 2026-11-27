import {
  extractPlaceholders,
  references,
  substitute
} from "@spica-server/function/src/placeholder";

describe("placeholder-text", () => {
  describe("extractPlaceholders", () => {
    it("should find both prefixes in nested objects and arrays", () => {
      const options = {a: ["${SECRET.USER}"], b: {c: "x${ENV.HOST}y"}};

      expect(extractPlaceholders(options)).toEqual([
        {prefix: "SECRET", key: "USER"},
        {prefix: "ENV", key: "HOST"}
      ]);
    });

    it.each(["{{SECRET.USER}}", "${USER}", "${OTHER.USER}", "$SECRET.USER"])(
      "should ignore %s",
      text => {
        expect(extractPlaceholders({url: text})).toEqual([]);
      }
    );

    it("should ignore non-string leaves and nullish values", () => {
      expect(extractPlaceholders({a: 1, b: true, c: null, d: undefined})).toEqual([]);
      expect(extractPlaceholders(undefined)).toEqual([]);
    });
  });

  describe("references", () => {
    it("should match by prefix and key", () => {
      const value = {url: "${ENV.HOST}"};

      expect(references(value, "ENV", ["HOST"])).toEqual(true);
      expect(references(value, "ENV", ["OTHER"])).toEqual(false);
      expect(references(value, "SECRET", ["HOST"])).toEqual(false);
    });

    it("should match any key when keys are omitted", () => {
      expect(references({url: "${ENV.HOST}"}, "ENV")).toEqual(true);
      expect(references({url: "plain"}, "ENV")).toEqual(false);
    });
  });

  describe("substitute", () => {
    const lookup = ({prefix, key}) => ({"SECRET.USER": "u", "ENV.HOST": "h"})[`${prefix}.${key}`];

    it("should substitute placeholders of both prefixes", () => {
      expect(substitute({url: "amqp://${SECRET.USER}@${ENV.HOST}"}, lookup)).toEqual({
        url: "amqp://u@h"
      });
    });

    it("should keep unresolved placeholders literal", () => {
      expect(substitute("${SECRET.MISSING}", lookup)).toEqual("${SECRET.MISSING}");
    });

    it("should insert replacement patterns literally", () => {
      expect(substitute("${ENV.X}", () => "$&$1$$")).toEqual("$&$1$$");
    });

    it("should not substitute object keys", () => {
      expect(substitute({"${ENV.HOST}": "v"}, lookup)).toEqual({"${ENV.HOST}": "v"});
    });

    it("should not mutate the input", () => {
      const input = {a: ["${ENV.HOST}"]};
      substitute(input, lookup);

      expect(input).toEqual({a: ["${ENV.HOST}"]});
    });

    it("should pass through non-string values", () => {
      expect(substitute(5, lookup)).toEqual(5);
      expect(substitute(null, lookup)).toEqual(null);
    });
  });
});
