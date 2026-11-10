import {BadRequestException} from "@spica-server/bucket-common";
import {isEncryptedData} from "@spica-server/core-encryption";
import {Session} from "@spica-server/data-postgresql-orm";
import {Bucket} from "@spica-server/interface-bucket";
import {BucketMetadata, ColumnMetadata, SYSTEM_COLUMNS, TableMetadata} from "../schema/index.js";
import {fieldKey, Row, RowSet} from "../shape/index.js";
import {toColumnValue, valueAt} from "./values.js";

type Properties = NonNullable<Bucket["properties"]>;

function encryptedPaths(properties: Properties = {}, prefix: string[] = []): string[][] {
  return Object.entries(properties).flatMap(([name, property]) => {
    const path = [...prefix, name];
    const items = property.items as Properties[string] | undefined;
    if (property.type == "encrypted" || items?.type == "encrypted") {
      return [path];
    }
    const holder = property.type == "object" ? property : items;
    return holder?.type == "object" && holder.properties
      ? encryptedPaths(holder.properties as Properties, path)
      : [];
  });
}

function encodeEncrypted(path: string[], value: unknown) {
  if (!isEncryptedData(value)) {
    throw new BadRequestException(`The property .${path.join(".")} must be an encrypted value.`);
  }
  const {encrypted, iv, authTag} = value;
  return JSON.stringify({encrypted, iv, authTag});
}

function keyOf(metadata: BucketMetadata, document: object) {
  const {field, generated} = metadata.primaryKey;
  const key = (document as Record<string, unknown>)[field];
  if (key === undefined || key === null) {
    if (!generated) {
      throw new BadRequestException(`The primary key .${field} is required.`);
    }
    return undefined;
  }
  return key;
}

export class Converter {
  private readonly encrypted: Set<string>;

  constructor(bucket: Bucket) {
    this.encrypted = new Set(encryptedPaths(bucket.properties).map(path => path.join("\0")));
  }

  value(column: ColumnMetadata, value: unknown) {
    const isEncrypted =
      this.encrypted.has(column.path.join("\0")) && value !== undefined && value !== null;
    return isEncrypted ? encodeEncrypted(column.path, value) : toColumnValue(column, value);
  }
}

export async function insertRows(
  session: Session,
  bucket: Bucket,
  metadata: BucketMetadata,
  document: object
): Promise<RowSet> {
  const converter = new Converter(bucket);
  const key = keyOf(metadata, document);
  const main = await insertMainRow(session, metadata, document, key, converter);
  await advanceSequence(session, metadata, key);

  const parent = main[metadata.primaryKey.column];
  const children: Record<string, Row[]> = {};
  for (const table of metadata.children) {
    const rows = childRows(table, document, parent, converter);
    children[fieldKey(table.path)] = await insertMany(session, table, rows);
  }
  return {main, children};
}

async function insertMainRow(
  session: Session,
  metadata: BucketMetadata,
  document: object,
  key: unknown,
  converter: Converter
) {
  const values: Row = {};
  for (const column of metadata.main.columns) {
    if (column.name != metadata.primaryKey.column || key !== undefined) {
      values[column.name] = converter.value(column, valueAt(document, column.path));
    }
  }
  return session.table(metadata.main.name).insertRow(values);
}

export function childRows(
  table: TableMetadata,
  document: object,
  parent: unknown,
  converter: Converter
): Row[] {
  const value = valueAt(document, table.path);
  if (value === undefined || value === null) {
    return [];
  }

  if (table.keyColumns.includes(SYSTEM_COLUMNS.locale)) {
    const valueColumn = table.columns.find(column => column.name == SYSTEM_COLUMNS.value)!;
    return Object.entries(value as Record<string, unknown>)
      .filter(([, translated]) => translated !== undefined && translated !== null)
      .map(([locale, translated]) => ({
        [SYSTEM_COLUMNS.parent]: parent,
        [SYSTEM_COLUMNS.locale]: locale,
        [SYSTEM_COLUMNS.value]: converter.value(valueColumn, translated)
      }));
  }

  return (value as unknown[]).map((item, position) => {
    const row: Row = {[SYSTEM_COLUMNS.parent]: parent, [SYSTEM_COLUMNS.position]: position};
    for (const column of table.columns) {
      if (column.name == SYSTEM_COLUMNS.parent || column.name == SYSTEM_COLUMNS.position) {
        continue;
      }
      const holdsItem = column.name == SYSTEM_COLUMNS.value || column.name == SYSTEM_COLUMNS.target;
      row[column.name] = converter.value(
        column,
        holdsItem ? item : valueAt(item, column.path.slice(table.path.length))
      );
    }
    return row;
  });
}

export function insertMany(session: Session, table: TableMetadata, rows: Row[]): Promise<Row[]> {
  return session.table(table.name).insertRows(rows);
}

async function advanceSequence(session: Session, metadata: BucketMetadata, key: unknown) {
  const {generated, type, column} = metadata.primaryKey;
  if (generated && key !== undefined && (type == "integer" || type == "bigint")) {
    await session.table(metadata.main.name).advanceSequence(column, String(key));
  }
}
