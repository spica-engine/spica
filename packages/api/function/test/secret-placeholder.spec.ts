import {
  hasSecretPlaceholder,
  resolveSecretPlaceholders
} from "@spica-server/function/src/secret-placeholder";

describe("Secret placeholder", () => {
  describe("hasSecretPlaceholder", () => {
    it("should detect a placeholder of the given secret", () => {
      expect(hasSecretPlaceholder({url: "amqp://${SECRET.USER}@host"}, ["USER"])).toEqual(true);
    });

    it("should detect a placeholder when any of the given secrets is referenced", () => {
      expect(hasSecretPlaceholder({password: "${SECRET.NEW}"}, ["OLD", "NEW"])).toEqual(true);
    });

    it("should not detect placeholders of other secrets", () => {
      expect(hasSecretPlaceholder({url: "amqp://${SECRET.USER}@host"}, ["PASSWORD"])).toEqual(
        false
      );
    });

    it("should detect placeholders in nested objects and arrays", () => {
      const options = {
        connection: {credentials: [{password: "${SECRET.PASSWORD}"}]}
      };

      expect(hasSecretPlaceholder(options, ["PASSWORD"])).toEqual(true);
    });

    it("should not detect anything when there is no placeholder", () => {
      expect(hasSecretPlaceholder({url: "amqp://user:pass@host"}, ["USER"])).toEqual(false);
    });

    it("should not treat a placeholder without the SECRET namespace as a secret", () => {
      expect(hasSecretPlaceholder({url: "${USER}", other: "{{USER}}"}, ["USER"])).toEqual(false);
    });

    it("should ignore non-string values", () => {
      expect(
        hasSecretPlaceholder({port: 5672, ssl: true, ca: null, frame: undefined}, ["USER"])
      ).toEqual(false);
    });

    it("should ignore placeholders used as object keys", () => {
      expect(hasSecretPlaceholder({"${SECRET.USER}": "value"}, ["USER"])).toEqual(false);
    });

    it("should detect a placeholder on a plain string value", () => {
      expect(hasSecretPlaceholder("${SECRET.USER}", ["USER"])).toEqual(true);
    });

    it("should not detect anything when no secret key is given", () => {
      expect(hasSecretPlaceholder({url: "${SECRET.USER}"}, [])).toEqual(false);
    });
  });

  describe("resolveSecretPlaceholders", () => {
    const secrets = new Map([
      ["USER", "guest"],
      ["PASSWORD", "s3cr3t"]
    ]);

    it("should replace a placeholder with the secret value", () => {
      expect(resolveSecretPlaceholders({username: "${SECRET.USER}"}, secrets)).toEqual({
        username: "guest"
      });
    });

    it("should replace every placeholder in the same string", () => {
      const options = {url: "amqp://${SECRET.USER}:${SECRET.PASSWORD}@host:5672/${SECRET.USER}"};

      expect(resolveSecretPlaceholders(options, secrets)).toEqual({
        url: "amqp://guest:s3cr3t@host:5672/guest"
      });
    });

    it("should replace placeholders in nested objects and arrays", () => {
      const options = {
        connection: {username: "${SECRET.USER}", hosts: ["${SECRET.USER}-1", "plain"]},
        queue: {name: "orders"}
      };

      expect(resolveSecretPlaceholders(options, secrets)).toEqual({
        connection: {username: "guest", hosts: ["guest-1", "plain"]},
        queue: {name: "orders"}
      });
    });

    it("should leave the placeholder as it is when the secret does not exist", () => {
      const options = {username: "${SECRET.USER}", password: "${SECRET.MISSING}"};

      expect(resolveSecretPlaceholders(options, secrets)).toEqual({
        username: "guest",
        password: "${SECRET.MISSING}"
      });
    });

    it("should put the placeholder back when the secret is removed", () => {
      const options = {password: "${SECRET.PASSWORD}"};

      expect(resolveSecretPlaceholders(options, new Map())).toEqual({
        password: "${SECRET.PASSWORD}"
      });
    });

    it("should insert secret values literally, even when they contain replacement patterns", () => {
      const options = {password: "${SECRET.PASSWORD}"};

      expect(resolveSecretPlaceholders(options, new Map([["PASSWORD", "$&$1$$"]]))).toEqual({
        password: "$&$1$$"
      });
    });

    it("should not resolve secrets referenced through unknown placeholder syntaxes", () => {
      const options = {a: "${USER}", b: "{{USER}}", c: "$SECRET.USER"};

      expect(resolveSecretPlaceholders(options, secrets)).toEqual(options);
    });

    it("should keep non-string values untouched", () => {
      const options = {port: 5672, ssl: true, ca: null, consumer: {offset: {value: 10}}};

      expect(resolveSecretPlaceholders(options, secrets)).toEqual(options);
    });

    it("should not mutate the given value", () => {
      const options = {connection: {username: "${SECRET.USER}"}, hosts: ["${SECRET.USER}"]};

      const resolved = resolveSecretPlaceholders(options, secrets);

      expect(options).toEqual({
        connection: {username: "${SECRET.USER}"},
        hosts: ["${SECRET.USER}"]
      });
      expect(resolved.connection).not.toBe(options.connection);
      expect(resolved.hosts).not.toBe(options.hosts);
    });

    it("should return undefined and null as they are", () => {
      expect(resolveSecretPlaceholders(undefined, secrets)).toBeUndefined();
      expect(resolveSecretPlaceholders(null, secrets)).toBeNull();
    });
  });
});
