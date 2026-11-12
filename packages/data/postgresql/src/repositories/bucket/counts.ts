import {Session} from "@spica-server/data-postgresql-orm";
import {buckets} from "../../entities/index.js";
import {mainTableName} from "../../schema/index.js";

export const countDocuments = (session: Session, tables: string[]) => session.countRows(tables);

export async function allBucketTables(session: Session): Promise<string[]> {
  const stored = await session.findMany(buckets, {}, {select: ["id"]});
  return stored.map(({id}) => mainTableName(String(id)));
}
