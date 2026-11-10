import {Session} from "@spica-server/data-postgresql-orm";
import {buckets} from "../../entities/index.js";
import {mainTableName} from "../../schema/index.js";

export const countDocuments = (session: Session, tables: string[]) => session.countRows(tables);

export async function allBucketTables(session: Session): Promise<string[]> {
  const stored = await session.findMany(buckets, {}, {select: ["_id"]});
  return stored.map(({_id}) => mainTableName(String(_id)));
}
