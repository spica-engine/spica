import {quote, Session} from "@spica-server/data-postgresql-orm";
import {buckets} from "../../entities/index.js";
import {mainTableName} from "../../schema/index.js";

const countOf = (table: string) => `(SELECT count(*) FROM ${quote(table)})`;

export async function countDocuments(session: Session, tables: string[]): Promise<number> {
  if (!tables.length) {
    return 0;
  }
  const {rows} = await session.raw<{total: string}>(
    `SELECT ${tables.map(countOf).join(" + ")} AS total`
  );
  return Number(rows[0].total);
}

export async function allBucketTables(session: Session): Promise<string[]> {
  const stored = await session.findMany(buckets, {}, {select: ["_id"]});
  return stored.map(({_id}) => mainTableName(String(_id)));
}
