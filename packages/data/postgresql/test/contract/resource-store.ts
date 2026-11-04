/*
 * TEMPORARY. Gives the resource filter contract one `reset / allowed` surface over both engines
 * while PostgreSQL has no query facade.
 *
 * Remove it once Part 8 binds COLLECTION_QUERY on PostgreSQL: `allowed` becomes
 * `COLLECTION_QUERY.find(collection, {resourceFilter})` on both engines and `reset` a repository
 * `deleteMany` plus inserts, so the spec needs no helper at all.
 */
import {TestingModule} from "@nestjs/testing";
import {createTables, defineEntity, Session} from "@spica-server/data-postgresql-orm";
import {renderResourceFilter} from "@spica-server/database-pipeline";
import {ContractEngine, DatabaseService} from "@spica-server/database-testing";
import {ID_TYPES, IdTypes, PG_POOL, ResourceFilterSpec} from "@spica-server/interface-data";
import pg from "pg";
import {keyParser, resourceFilterCondition} from "../../src/access/resource-filter";

const COLLECTION = "resource_filter_cases";

const entity = defineEntity<{id: string}>({table: COLLECTION, columns: {}});

export interface ResourceStore {
  /** Replaces the stored resources with `count` new ones and returns their ids. */
  reset(count: number): Promise<string[]>;
  /** The ids, sorted, that the filter lets through. */
  allowed(filter: ResourceFilterSpec | undefined): Promise<string[]>;
  newId(): string;
}

export async function createResourceStore(
  engine: ContractEngine,
  module: TestingModule
): Promise<ResourceStore> {
  const idType = module.get<IdTypes>(ID_TYPES).forCollection(COLLECTION);
  const newId = () => idType.serialize(idType.generate());

  if (engine.name == "mongodb") {
    const collection = () => module.get(DatabaseService).collection(COLLECTION);
    return {
      newId,
      async reset(count) {
        const ids = Array.from({length: count}, newId);
        await collection().deleteMany({});
        await collection().insertMany(ids.map(id => ({_id: idType.parse(id) as never})));
        return ids;
      },
      async allowed(filter) {
        const stage = renderResourceFilter(filter, id => idType.parse(id));
        const found = await collection()
          .find(stage?.$match ?? {})
          .toArray();
        return found.map(document => idType.serialize(document._id as never)).sort();
      }
    };
  }

  const pool = module.get<pg.Pool>(PG_POOL);
  const session = new Session(pool);
  await createTables(pool, [entity]);
  return {
    newId,
    async reset(count) {
      const ids = Array.from({length: count}, newId);
      await pool.query(`TRUNCATE ${COLLECTION}`);
      for (const id of ids) {
        await session.insert(entity, {id});
      }
      return ids;
    },
    async allowed(filter) {
      const found = await session.findMany(entity, {
        id: resourceFilterCondition(filter, keyParser("uuid"))
      });
      return found.map(row => row.id).sort();
    }
  };
}
