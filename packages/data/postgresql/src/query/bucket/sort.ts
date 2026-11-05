import {BadRequestException} from "@nestjs/common";
import {quote} from "@spica-server/data-postgresql-orm";
import {BucketMetadata} from "../../schema/index.js";
import {tableColumn} from "./plan.js";

const ASCENDING_MISSING_FIRST = "ASC NULLS FIRST";
const DESCENDING_MISSING_LAST = "DESC NULLS LAST";

export function orderBy(metadata: BucketMetadata, sort?: object): string {
  const columns = new Set<string>();
  const terms: string[] = [];

  for (const [path, direction] of Object.entries(sort ?? {})) {
    const column = metadata.columnOf(path.split("."));
    if (!column || column.table != metadata.main.name) {
      throw new BadRequestException(`Documents cannot be sorted by "${path}".`);
    }
    if (!columns.has(column.name)) {
      columns.add(column.name);
      const order = Number(direction) == -1 ? DESCENDING_MISSING_LAST : ASCENDING_MISSING_FIRST;
      terms.push(`${tableColumn(column.name)} ${order}`);
    }
  }

  const key = metadata.primaryKey.column;
  if (!columns.has(key)) {
    terms.push(`${tableColumn(key)} ASC`);
  }
  return terms.join(", ");
}
