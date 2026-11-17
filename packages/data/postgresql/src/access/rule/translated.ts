import {literalOf, quote} from "@spica-server/data-postgresql-orm";
import {SYSTEM_COLUMNS} from "../../schema/naming.js";
import {TableMetadata} from "../../schema/metadata/types.js";

export interface LocaleScope {
  best: string;
  fallback: string;
}

const LOCALE_CODE = /^[A-Za-z0-9_-]{1,20}$/;

function checkedLocaleLiteral(value: string) {
  if (!LOCALE_CODE.test(value)) {
    throw new Error(`"${value}" is not a locale code.`);
  }
  return literalOf(value);
}

export function translatedValueSql(
  table: TableMetadata,
  parent: string,
  locale: LocaleScope
): string {
  const translationIn = (language: string) =>
    `(SELECT ${quote(SYSTEM_COLUMNS.value)} FROM ${quote(table.name)} AS ${quote("_l")} WHERE ${quote("_l")}.${quote(SYSTEM_COLUMNS.parent)} = ${parent} AND ${quote("_l")}.${quote(SYSTEM_COLUMNS.locale)} = ${checkedLocaleLiteral(language)})`;
  return `COALESCE(${translationIn(locale.best)}, ${translationIn(locale.fallback)})`;
}
