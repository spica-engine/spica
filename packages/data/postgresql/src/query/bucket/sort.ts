import {BadRequestException} from "@nestjs/common";
import {quote} from "@spica-server/data-postgresql-orm";
import {BucketMetadata} from "../../schema/index.js";
import {TABLE} from "./plan.js";

// MongoDB sorts a missing value before every other one, so ascending puts NULL first.
const DIRECTIONS = {asc: "ASC NULLS FIRST", desc: "DESC NULLS LAST"};

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
      const order = Number(direction) == -1 ? DIRECTIONS.desc : DIRECTIONS.asc;
      terms.push(`${quote(TABLE)}.${quote(column.name)} ${order}`);
    }
  }

  const key = metadata.primaryKey.column;
  if (!columns.has(key)) {
    terms.push(`${quote(TABLE)}.${quote(key)} ASC`);
  }
  return terms.join(", ");
}
