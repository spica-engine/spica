import {EnvVarChangeDispatcher, EnvVarService} from "@spica-server/env_var-services";
import {EnvVar, EnvVarRepository} from "@spica-server/interface-env_var";
import {idOf, withId} from "@spica-server/data";

const ID = "1";

const envVarOf = (key: string, value: string): EnvVar => withId({key, value}, ID);

function repositoryHolding(initial: EnvVar | null) {
  let stored = initial;
  return {
    findById: async () => stored,
    replaceById: async (_id: unknown, envVar: EnvVar) => {
      const previous = stored;
      if (previous) stored = envVar;
      return previous;
    },
    updateById: async (_id: unknown, fields: Partial<EnvVar>) => {
      const previous = stored;
      if (previous) stored = {...previous, ...fields};
      return previous;
    }
  } as unknown as EnvVarRepository;
}

function serviceHolding(initial: EnvVar | null) {
  const service = new EnvVarService(repositoryHolding(initial), new EnvVarChangeDispatcher());
  const events: {operationType: string}[] = [];
  service.watchChanges().subscribe(event => events.push(event));
  return {service, events};
}

describe("EnvVarService change events", () => {
  describe("replaceById", () => {
    it("does not dispatch when key and value are unchanged", async () => {
      const {service, events} = serviceHolding(envVarOf("HOST", "a"));

      await service.replaceById(ID, envVarOf("HOST", "a"));

      expect(events).toEqual([]);
    });

    it("dispatches when the value changes", async () => {
      const {service, events} = serviceHolding(envVarOf("HOST", "a"));

      await service.replaceById(ID, envVarOf("HOST", "b"));

      expect(events.map(e => e.operationType)).toEqual(["replace"]);
    });

    it("dispatches when the key changes", async () => {
      const {service, events} = serviceHolding(envVarOf("HOST", "a"));

      await service.replaceById(ID, envVarOf("RENAMED", "a"));

      expect(events.map(e => e.operationType)).toEqual(["replace"]);
    });

    it("resolves to the new env var", async () => {
      const {service} = serviceHolding(envVarOf("HOST", "a"));

      const result = await service.replaceById(ID, {key: "HOST", value: "b"});

      expect(result).toMatchObject({key: "HOST", value: "b"});
      expect(idOf(result)).toEqual(ID);
    });

    it("resolves to null without dispatching when the env var does not exist", async () => {
      const {service, events} = serviceHolding(null);

      expect(await service.replaceById(ID, envVarOf("HOST", "a"))).toBeNull();
      expect(events).toEqual([]);
    });
  });

  describe("updateById", () => {
    it("does not dispatch when the given fields do not change key or value", async () => {
      const {service, events} = serviceHolding(envVarOf("HOST", "a"));

      await service.updateById(ID, {value: "a"});
      await service.updateById(ID, {updated_at: new Date()});

      expect(events).toEqual([]);
    });

    it("dispatches when the value changes", async () => {
      const {service, events} = serviceHolding(envVarOf("HOST", "a"));

      await service.updateById(ID, {value: "b"});

      expect(events.map(e => e.operationType)).toEqual(["update"]);
    });

    it("resolves to the updated env var", async () => {
      const {service} = serviceHolding(envVarOf("HOST", "a"));

      expect(await service.updateById(ID, {value: "b"})).toMatchObject({value: "b"});
    });

    it("resolves to null without dispatching when the env var does not exist", async () => {
      const {service, events} = serviceHolding(null);

      expect(await service.updateById(ID, {value: "a"})).toBeNull();
      expect(events).toEqual([]);
    });
  });
});
