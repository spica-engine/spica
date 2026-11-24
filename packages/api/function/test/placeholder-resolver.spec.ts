import {Logger} from "@nestjs/common";
import {ChangeKind} from "@spica-server/interface-function";
import {FunctionPlaceholderResolver} from "@spica-server/function/src/placeholder";

describe("FunctionPlaceholderResolver", () => {
  const source = (prefix: string, values: Record<string, string>) => ({
    prefix,
    load: () => new Map(Object.entries(values))
  });
  const sources: any = [source("ENV", {WARM: "2", BAD: "abc"}), source("SECRET", {URL: "amqp://s"})];
  const options: any = {timeout: 60};

  let resolver: FunctionPlaceholderResolver;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    resolver = new FunctionPlaceholderResolver({} as any, sources, options);
    warn = jest.spyOn(Logger.prototype, "warn").mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  describe("resolveRuntimeConfig", () => {
    const config = (fn: object) => resolver.resolveRuntimeConfig({name: "fn", ...fn} as any);

    it("should pass numbers through", () => {
      expect(config({timeout: 5, warmWorkers: 1, concurrencyPerWorker: 3})).toEqual({
        timeout: 5,
        warmWorkers: 1,
        concurrencyPerWorker: 3
      });
    });

    it("should resolve placeholders to numbers", () => {
      expect(config({timeout: 5, warmWorkers: "${ENV.WARM}"}).warmWorkers).toEqual(2);
    });

    it("should use defaults when fields are absent", () => {
      expect(config({timeout: undefined})).toEqual({
        timeout: 60,
        warmWorkers: 0,
        concurrencyPerWorker: 1
      });
    });

    it("should fall back and warn when the key is missing", () => {
      expect(config({timeout: 5, warmWorkers: "${ENV.MISSING}"}).warmWorkers).toEqual(0);
      expect(warn).toHaveBeenCalled();
    });

    it("should fall back and warn when the value is not numeric", () => {
      expect(config({timeout: 5, concurrencyPerWorker: "${ENV.BAD}"}).concurrencyPerWorker).toEqual(1);
      expect(warn).toHaveBeenCalled();
    });

    it("should fall back to the deployment timeout", () => {
      expect(config({timeout: "${ENV.BAD}"}).timeout).toEqual(60);
    });
  });

  describe("resolveRouting", () => {
    const change = (kind: ChangeKind, url: string): any => ({
      kind,
      type: "rabbitmq",
      options: {url},
      target: {id: "1", handler: "h", name: "fn"}
    });

    it("should leave removed changes and placeholder-free options untouched", async () => {
      const routing = [
        change(ChangeKind.Removed, "${ENV.WARM}"),
        change(ChangeKind.Added, "plain")
      ];

      expect(await resolver.resolveRouting(routing)).toEqual(routing);
    });
  });
});
