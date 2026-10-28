import pg from "pg";
import {Entity} from "./entity.js";
import {translateError} from "./errors.js";
import {Aggregation, isUnconditional, Where} from "./expressions.js";
import {
  aggregateSql,
  countSql,
  deleteSql,
  changedColumns,
  FindOptions,
  fromRow,
  insertManySql,
  insertSql,
  replaceSql,
  Returning,
  selectSql,
  Statement,
  updateSql,
  upsertSql,
  UpsertOptions
} from "./sql.js";

export interface Queryable {
  query(text: string, values?: unknown[]): Promise<pg.QueryResult>;
}

export interface ReturningOption {
  returning?: Returning;
}

type Changes<R> = Partial<Omit<R, "id">> & Record<string, unknown>;

export class Session {
  constructor(readonly db: Queryable) {}

  async raw<T extends pg.QueryResultRow = any>(text: string, values: unknown[] = []) {
    return (await this.db.query(text, values)) as pg.QueryResult<T>;
  }

  async insert<R>(entity: Entity<R>, record: Partial<R>): Promise<R> {
    const [row] = await this.run(entity, insertSql(entity, record));
    return row;
  }

  async insertMany<R>(entity: Entity<R>, records: Partial<R>[]): Promise<R[]> {
    if (!records.length) {
      return [];
    }
    return this.run(entity, insertManySql(entity, records));
  }

  async findById<R>(entity: Entity<R>, id: unknown): Promise<R | null> {
    return this.findOne(entity, {id});
  }

  async findOne<R>(
    entity: Entity<R>,
    where: Where,
    options: Omit<FindOptions, "limit" | "offset"> = {}
  ): Promise<R | null> {
    const [row] = await this.run(entity, selectSql(entity, where, {...options, limit: 1}));
    return row ?? null;
  }

  async findMany<R>(entity: Entity<R>, where: Where = {}, options?: FindOptions): Promise<R[]> {
    return this.run(entity, selectSql(entity, where, options));
  }

  async count(entity: Entity, where: Where = {}): Promise<number> {
    const {rows} = await this.query(entity, countSql(entity, where));
    return Number(rows[0].count);
  }

  async updateById<R>(
    entity: Entity<R>,
    id: unknown,
    changes: Changes<R>,
    {returning = "after"}: ReturningOption = {}
  ): Promise<R | null> {
    if (!changedColumns(entity, id, changes).length) {
      return this.findById(entity, id);
    }
    const [row] = await this.run(entity, updateSql(entity, id, changes, returning));
    return row ?? null;
  }

  async replaceById<R>(
    entity: Entity<R>,
    id: unknown,
    record: Partial<R>,
    {returning = "after"}: ReturningOption = {}
  ): Promise<R | null> {
    const [row] = await this.run(entity, replaceSql(entity, id, record, returning));
    return row ?? null;
  }

  async deleteById<R>(entity: Entity<R>, id: unknown): Promise<R | null> {
    const [row] = await this.run(entity, deleteSql(entity, {id}));
    return row ?? null;
  }

  async deleteMany<R>(entity: Entity<R>, where: Where): Promise<R[]> {
    if (isUnconditional(where)) {
      throw new Error(`deleteMany on "${entity.table}" needs a condition; use deleteAll.`);
    }
    return this.run(entity, deleteSql(entity, where));
  }

  async deleteWhere(entity: Entity, where: Where): Promise<number> {
    if (isUnconditional(where)) {
      throw new Error(`deleteWhere on "${entity.table}" needs a condition; use deleteAll.`);
    }
    const {rowCount} = await this.query(entity, deleteSql(entity, where, false));
    return rowCount ?? 0;
  }

  async deleteAll<R>(entity: Entity<R>): Promise<R[]> {
    return this.run(entity, deleteSql(entity, {}));
  }

  async aggregate<K extends string>(
    entity: Entity,
    aggregations: Record<K, Aggregation>,
    where: Where = {}
  ): Promise<Record<K, number>> {
    const {rows} = await this.query(entity, aggregateSql(entity, aggregations, where));
    return Object.fromEntries(
      Object.entries(rows[0]).map(([alias, value]) => [alias, Number(value)])
    ) as Record<K, number>;
  }

  async lockTransaction(name: string): Promise<void> {
    await this.db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [name]);
  }

  async upsert<R>(
    entity: Entity<R>,
    record: Partial<R>,
    options: UpsertOptions
  ): Promise<R | null> {
    const [row] = await this.run(entity, upsertSql(entity, record, options));
    return row ?? null;
  }

  transaction<T>(work: (session: Session) => Promise<T>): Promise<T> {
    return work(this);
  }

  private async query(entity: Entity, statement: Statement) {
    try {
      return await this.db.query(statement.text, statement.values);
    } catch (error) {
      throw translateError(error, entity);
    }
  }

  private async run<R>(entity: Entity<R>, statement: Statement): Promise<R[]> {
    const {rows} = await this.query(entity, statement);
    return rows.map(row => fromRow(entity, row));
  }
}

export class Orm extends Session {
  constructor(private readonly pool: pg.Pool) {
    super(pool);
  }

  override async lockTransaction(): Promise<void> {
    throw new Error("A transaction lock needs a transaction.");
  }

  override async transaction<T>(work: (session: Session) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    let rollbackFailed = false;
    try {
      await client.query("BEGIN");
      const result = await work(new Session(client));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => (rollbackFailed = true));
      throw error;
    } finally {
      client.release(rollbackFailed);
    }
  }
}
