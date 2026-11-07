import {BadRequestException} from "@nestjs/common";
import {LocaleScope, translatedValueSql} from "../../access/index.js";
import {BucketMetadata, SYSTEM_COLUMNS} from "../../schema/index.js";
import {tableColumn} from "./plan.js";

const ASCENDING_MISSING_FIRST = "ASC NULLS FIRST";
const DESCENDING_MISSING_LAST = "DESC NULLS LAST";

export function orderBy(metadata: BucketMetadata, sort?: object, locale?: LocaleScope): string {
  const columns = new Set<string>();
  const terms: string[] = [];

  for (const [path, direction] of Object.entries(sort ?? {})) {
    const segments = path.split(".");
    const column = metadata.columnOf(segments);
    const translated = metadata.children.find(
      table =>
        table.name == column?.table &&
        table.keyColumns.includes(SYSTEM_COLUMNS.locale) &&
        segments.length == 1
    );
    if (!column || (column.table != metadata.main.name && !(translated && locale))) {
      throw new BadRequestException(`Documents cannot be sorted by "${path}".`);
    }
    if (!columns.has(path)) {
      columns.add(path);
      const order = Number(direction) == -1 ? DESCENDING_MISSING_LAST : ASCENDING_MISSING_FIRST;
      const value = translated
        ? translatedValueSql(translated, tableColumn(metadata.primaryKey.column), locale)
        : tableColumn(column.name);
      terms.push(`${value} ${order}`);
    }
  }

  const key = metadata.primaryKey.column;
  if (!columns.has(metadata.primaryKey.field)) {
    terms.push(`${tableColumn(key)} ASC`);
  }
  return terms.join(", ");
}
