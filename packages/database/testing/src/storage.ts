import {TestingModule} from "@nestjs/testing";
import {DatabaseService, ObjectId} from "@spica-server/database";
import {PG_POOL} from "@spica-server/interface-data";
import pg from "pg";
import {v7} from "uuid";
import {ContractEngine} from "./contract";

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

export function idAt(engine: ContractEngine, time: Date) {
  return engine.name == "mongodb"
    ? ObjectId.createFromTime(time.getTime() / 1000)
    : v7({msecs: time.getTime()});
}

export async function ensureCollections(
  engine: ContractEngine,
  module: TestingModule,
  names: string[]
) {
  if (engine.name != "mongodb") {
    return;
  }
  const db = module.get(DatabaseService);
  const existing = new Set((await db.listCollections().toArray()).map(({name}) => name));
  for (const name of names.filter(name => !existing.has(name))) {
    await db.createCollection(name);
  }
}
