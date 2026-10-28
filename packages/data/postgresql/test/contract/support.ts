import {TestingModule} from "@nestjs/testing";
import {ContractEngine, DatabaseService} from "@spica-server/database-testing";
import {PG_POOL} from "@spica-server/interface-data";
import pg from "pg";

export async function clearStorage(
  engine: ContractEngine,
  module: TestingModule,
  storage: {mongodb: string[]; postgresql: string[]}
) {
  if (engine.name == "mongodb") {
    const db = module.get(DatabaseService);
    for (const collection of storage.mongodb) {
      await db.collection(collection).deleteMany({});
    }
  } else {
    await module.get<pg.Pool>(PG_POOL).query(`TRUNCATE ${storage.postgresql.join(", ")}`);
  }
}

export async function waitForMongoIndexes(
  engine: ContractEngine,
  module: TestingModule,
  expected: Record<string, string[]>
) {
  if (engine.name != "mongodb") {
    return;
  }
  const db = module.get(DatabaseService);
  for (const [collection, names] of Object.entries(expected)) {
    for (let attempt = 0; attempt < 100; attempt++) {
      const existing = await db
        .collection(collection)
        .indexes()
        .catch(() => []);
      if (names.every(name => existing.some(index => index.name == name))) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
}
