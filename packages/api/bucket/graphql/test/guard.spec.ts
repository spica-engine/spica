import {Logger} from "@nestjs/common";
import {GraphqlController} from "@spica-server/bucket-graphql";

describe("GraphqlController engine guard", () => {
  const flush = () => new Promise(resolve => setTimeout(resolve));

  function controller(engine: string | undefined, findAll: () => Promise<unknown[]>) {
    const subscribe = jest.fn();
    const use = jest.fn();
    const instance = new GraphqlController(
      {httpAdapter: {getInstance: () => ({use})}} as any,
      {schemaChangeEmitter: {subscribe}, findAll} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      undefined as any,
      undefined as any,
      undefined as any,
      undefined,
      undefined,
      engine
    );
    return {instance, subscribe, use};
  }

  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, "warn").mockImplementation();
    error = jest.spyOn(Logger.prototype, "error").mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  describe("on PostgreSQL", () => {
    it("should not watch the buckets or mount the endpoint, and say why", () => {
      const {instance, subscribe, use} = controller("postgresql", async () => []);

      instance.onModuleInit();

      expect(subscribe).not.toHaveBeenCalled();
      expect(use).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("not supported on PostgreSQL"));
    });
  });

  describe("on an engine that supports it", () => {
    it("should mount the endpoint", () => {
      const {instance, use} = controller("mongodb", async () => []);

      instance.onModuleInit();

      expect(use).toHaveBeenCalledWith("/graphql", expect.any(Function));
      expect(warn).not.toHaveBeenCalled();
    });

    it("should log a schema that cannot be built instead of throwing", async () => {
      const malformed = {title: "no properties and no key"};
      const {subscribe} = controller("mongodb", async () => [malformed]);
      const rebuild = subscribe.mock.calls[0][0] as () => void;

      expect(() => rebuild()).not.toThrow();
      await flush();

      expect(error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to build the GraphQL schema")
      );
    });

    it("should log a failure to read the buckets instead of throwing", async () => {
      const {subscribe} = controller("mongodb", async () => {
        throw new Error("storage is down");
      });
      const rebuild = subscribe.mock.calls[0][0] as () => void;

      expect(() => rebuild()).not.toThrow();
      await flush();

      expect(error).toHaveBeenCalledWith(expect.stringContaining("storage is down"));
    });
  });
});
