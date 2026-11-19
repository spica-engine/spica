import {SecretChangeDispatcher, SecretService} from "@spica-server/secret-services";
import {Secret, SecretRepository} from "@spica-server/interface-secret";
import {encrypt} from "@spica-server/core-encryption";
import {idOf, withId} from "@spica-server/data";

const ENCRYPTION_SECRET = "test-encryption-secret-32chars!!";
const ID = "1";

const secretOf = (key: string, value: string): Secret =>
  withId({key, value: encrypt(value, ENCRYPTION_SECRET)}, ID);

function repositoryHolding(initial: Secret | null) {
  let stored = initial;
  return {
    findById: async () => stored,
    replaceById: async (_target: unknown, secret: Secret) => {
      const previous = stored;
      if (previous) stored = secret;
      return previous;
    },
    updateById: async (_target: unknown, fields: Partial<Secret>) => {
      const previous = stored;
      if (previous) stored = {...previous, ...fields};
      return previous;
    }
  } as unknown as SecretRepository;
}

function serviceHolding(initial: Secret | null) {
  const service = new SecretService(
    repositoryHolding(initial),
    ENCRYPTION_SECRET,
    new SecretChangeDispatcher()
  );
  const events: {operationType: string; keys: string[]}[] = [];
  service.watchChanges().subscribe(event => events.push(event));
  return {service, events};
}

describe("SecretService change events", () => {
  describe("replaceById", () => {
    it("does not dispatch when key and value are unchanged", async () => {
      const {service, events} = serviceHolding(secretOf("TOKEN", "a"));

      await service.replaceById(ID, secretOf("TOKEN", "a"));

      expect(events).toEqual([]);
    });

    it("dispatches when the value changes", async () => {
      const {service, events} = serviceHolding(secretOf("TOKEN", "a"));

      await service.replaceById(ID, secretOf("TOKEN", "b"));

      expect(events).toEqual([
        expect.objectContaining({operationType: "replace", keys: ["TOKEN"]})
      ]);
    });

    it("dispatches both keys when only the key changes", async () => {
      const {service, events} = serviceHolding(secretOf("OLD", "a"));

      await service.replaceById(ID, secretOf("NEW", "a"));

      expect(events[0].keys).toEqual(["OLD", "NEW"]);
    });

    it("dispatches when the previous value cannot be decrypted", async () => {
      const broken = {...secretOf("TOKEN", "a"), value: {encrypted: "x", iv: "x", authTag: "x"}};
      const {service, events} = serviceHolding(broken);

      await service.replaceById(ID, secretOf("TOKEN", "a"));

      expect(events).toHaveLength(1);
    });

    it("does not dispatch when the secret does not exist", async () => {
      const {service, events} = serviceHolding(null);

      const result = await service.replaceById(ID, secretOf("TOKEN", "a"));

      expect(result).toBeNull();
      expect(events).toEqual([]);
    });

    it("returns the replaced secret with the id of the previous one", async () => {
      const {service} = serviceHolding(secretOf("TOKEN", "a"));

      const result = await service.replaceById(ID, secretOf("TOKEN", "a"));

      expect(idOf(result)).toBe(ID);
    });
  });

  describe("updateById", () => {
    it("does not dispatch when the update leaves key and value unchanged", async () => {
      const {service, events} = serviceHolding(secretOf("TOKEN", "a"));

      await service.updateById(ID, {updated_at: new Date()});

      expect(events).toEqual([]);
    });

    it("dispatches when the update changes the value", async () => {
      const {service, events} = serviceHolding(secretOf("TOKEN", "a"));

      await service.updateById(ID, {value: encrypt("b", ENCRYPTION_SECRET)});

      expect(events).toEqual([expect.objectContaining({operationType: "update", keys: ["TOKEN"]})]);
    });
  });
});
