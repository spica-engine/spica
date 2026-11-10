import {DynamicModule} from "@nestjs/common";
import {TestingModule} from "@nestjs/testing";
import {DatabaseService} from "@spica-server/database";
import {PG_POOL} from "@spica-server/interface-data";
import {getConnectionUri} from "./start";
import {DatabaseTestingModule} from "./testing.module";

export type ContractEngineName = "mongodb" | "postgresql";

export interface ContractEngine {
  name: ContractEngineName;
  module(): DynamicModule;
  sharing(first: TestingModule): DynamicModule;
}

const engines: ContractEngine[] = [
  {
    name: "mongodb",
    module: () => DatabaseTestingModule.replicaSet(),
    sharing: first =>
      DatabaseTestingModule.connect(getConnectionUri(), first.get(DatabaseService).databaseName)
  },
  {
    name: "postgresql",
    module: () => DatabaseTestingModule.postgres(),
    sharing: first =>
      DatabaseTestingModule.connectPostgres(first.get(PG_POOL).options.connectionString)
  }
];

function isEnabled(name: ContractEngineName) {
  const selected = process.env.SPICA_CONTRACT_ENGINES;
  if (selected) {
    return selected.split(",").includes(name);
  }
  return name == "mongodb" || !!process.env.POSTGRES_URL;
}

declare const describe: {
  (name: string, fn: () => void): void;
  skip(name: string, fn: () => void): void;
};

declare const it: (name: string, fn: () => void) => void;

export function contractSuite(name: string, define: (engine: ContractEngine) => void) {
  for (const engine of engines) {
    if (isEnabled(engine.name)) {
      describe(`${name} [${engine.name}]`, () => define(engine));
    } else if (process.env.CI == "true") {
      describe(`${name} [${engine.name}]`, () =>
        it("needs its database service in CI", () => {
          throw new Error(
            `The ${engine.name} cases of "${name}" would be skipped. Start the service and set its URL in CI.`
          );
        }));
    } else {
      describe.skip(`${name} [${engine.name}] (set POSTGRES_URL or SPICA_CONTRACT_ENGINES)`, () =>
        define(engine));
    }
  }
}

export function mongoOnly(reason: string) {
  if (!reason.trim()) {
    throw new Error("mongoOnly needs the reason this spec can not run on PostgreSQL.");
  }
}
