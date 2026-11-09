import type {Queryable} from "./session.js";
import {quote} from "./sql.js";

export type TableRow = Record<string, unknown>;

const MAX_PARAMETERS = 30_000;

export class DynamicTable {
  constructor(
    private readonly db: Queryable,
    readonly name: string
  ) {}

  async rows(orderBy: string[] = []): Promise<TableRow[]> {
    const order = orderBy.length ? ` ORDER BY ${orderBy.map(quote).join(", ")}` : "";
    const {rows} = await this.db.query(`SELECT * FROM ${quote(this.name)}${order}`);
    return rows;
  }

  async rowsWhere(column: string, value: unknown): Promise<TableRow[]> {
    const {rows} = await this.db.query(
      `SELECT * FROM ${quote(this.name)} WHERE ${quote(column)} = $1`,
      [value]
    );
    return rows;
  }

  async insertRow(values: TableRow): Promise<TableRow> {
    const columns = Object.keys(values);
    const text = columns.length
      ? `INSERT INTO ${quote(this.name)} (${columns.map(quote).join(", ")}) VALUES (${columns.map((_, index) => `$${index + 1}`).join(", ")}) RETURNING *`
      : `INSERT INTO ${quote(this.name)} DEFAULT VALUES RETURNING *`;
    const {rows} = await this.db.query(text, Object.values(values));
    return rows[0];
  }

  async insertRows(rows: TableRow[]): Promise<TableRow[]> {
    if (!rows.length) {
      return [];
    }
    const columns = Object.keys(rows[0]);
    const perStatement = Math.max(1, Math.floor(MAX_PARAMETERS / columns.length));
    const inserted: TableRow[] = [];

    for (let start = 0; start < rows.length; start += perStatement) {
      const batch = rows.slice(start, start + perStatement);
      const tuples = batch.map(
        (_, row) =>
          `(${columns.map((_, column) => `$${row * columns.length + column + 1}`).join(", ")})`
      );
      const result = await this.db.query(
        `INSERT INTO ${quote(this.name)} (${columns.map(quote).join(", ")}) VALUES ${tuples.join(", ")} RETURNING *`,
        batch.flatMap(row => columns.map(column => row[column]))
      );
      inserted.push(...result.rows);
    }
    return inserted;
  }

  async updateRow(
    keyColumn: string,
    key: unknown,
    values: TableRow
  ): Promise<TableRow | undefined> {
    const assignments = Object.keys(values).map(
      (column, index) => `${quote(column)} = $${index + 2}`
    );
    const {rows} = await this.db.query(
      `UPDATE ${quote(this.name)} SET ${assignments.join(", ")} WHERE ${quote(keyColumn)} = $1 RETURNING *`,
      [key, ...Object.values(values)]
    );
    return rows[0];
  }

  async lockRow(keyColumn: string, key: unknown): Promise<TableRow | undefined> {
    const {rows} = await this.db.query(
      `SELECT * FROM ${quote(this.name)} WHERE ${quote(keyColumn)} = $1 FOR UPDATE`,
      [key]
    );
    return rows[0];
  }

  async deleteWhere(column: string, value: unknown): Promise<number> {
    const {rowCount} = await this.db.query(
      `DELETE FROM ${quote(this.name)} WHERE ${quote(column)} = $1`,
      [value]
    );
    return rowCount ?? 0;
  }

  async deleteWhereIn(column: string, values: unknown[]): Promise<number> {
    const {rowCount} = await this.db.query(
      `DELETE FROM ${quote(this.name)} WHERE ${quote(column)} = ANY($1)`,
      [values]
    );
    return rowCount ?? 0;
  }

  async smallest(column: string, limit: number): Promise<unknown[]> {
    const {rows} = await this.db.query(
      `SELECT ${quote(column)} AS value FROM ${quote(this.name)} ORDER BY ${quote(column)} ASC LIMIT $1`,
      [limit]
    );
    return rows.map(row => row.value);
  }

  async advanceSequence(column: string, atLeast: number | string | bigint): Promise<void> {
    await this.db.query(
      `SELECT setval(sequence.name, GREATEST($3::bigint, COALESCE(pg_sequence_last_value(sequence.name), 1)))
       FROM (SELECT pg_get_serial_sequence($1, $2)::regclass AS name) AS sequence`,
      [quote(this.name), column, String(atLeast)]
    );
  }
}

export async function countAllRows(db: Queryable, tables: string[]): Promise<number> {
  if (!tables.length) {
    return 0;
  }
  const counts = tables.map(table => `(SELECT count(*) FROM ${quote(table)})`).join(" + ");
  const {rows} = await db.query(`SELECT ${counts} AS total`);
  return Number(rows[0].total);
}
