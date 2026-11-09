import {BadRequestException} from "@spica-server/bucket-common";
import {quote, Session} from "@spica-server/data-postgresql-orm";
import {Bucket} from "@spica-server/interface-bucket";
import {BucketMetadata, TableMetadata} from "../schema/index.js";
import {RowSet} from "../shape/index.js";
import {toColumnValue, valueAt} from "./values.js";

type Properties = NonNullable<Bucket["properties"]>;

const isPresent = (value: unknown) => {
  if (value === undefined || value === null) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return typeof value != "object" || value instanceof Date || Object.keys(value).length > 0;
};

function encryptedPaths(properties: Properties = {}, prefix: string[] = []): string[][] {
  return Object.entries(properties).flatMap(([name, property]) => {
    const path = [...prefix, name];
    if (property.type == "encrypted") {
      return [path];
    }
    return property.type == "object" && property.properties
      ? encryptedPaths(property.properties as Properties, path)
      : [];
  });
}

function assertWritable(bucket: Bucket, metadata: BucketMetadata, document: object) {
  const unsupported = [
    ...encryptedPaths(bucket.properties),
    ...metadata.children.map(table => table.path)
  ].find(path => isPresent(valueAt(document, path)));

  if (unsupported) {
    throw new BadRequestException(
      `The property .${unsupported.join(".")} cannot be written to PostgreSQL yet.`
    );
  }
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

export async function insertRows(
  session: Session,
  bucket: Bucket,
  metadata: BucketMetadata,
  document: object
): Promise<RowSet> {
  assertWritable(bucket, metadata, document);
  const key = keyOf(metadata, document);
  const main = await insertMainRow(session, metadata.main, metadata, document, key);
  await advanceSequence(session, metadata, key);
  return {main, children: {}};
}

async function insertMainRow(
  session: Session,
  table: TableMetadata,
  metadata: BucketMetadata,
  document: object,
  key: unknown
) {
  const written = table.columns
    .filter(column => column.name != metadata.primaryKey.column || key !== undefined)
    .map(column => ({
      name: column.name,
      value: toColumnValue(column, valueAt(document, column.path))
    }));

  const names = written.map(({name}) => quote(name)).join(", ");
  const placeholders = written.map((_, index) => `$${index + 1}`).join(", ");
  const sql = written.length
    ? `INSERT INTO ${quote(table.name)} (${names}) VALUES (${placeholders}) RETURNING *`
    : `INSERT INTO ${quote(table.name)} DEFAULT VALUES RETURNING *`;

  const {rows} = await session.raw(
    sql,
    written.map(({value}) => value)
  );
  return rows[0];
}

async function advanceSequence(session: Session, metadata: BucketMetadata, key: unknown) {
  const {generated, type, column} = metadata.primaryKey;
  if (!generated || key === undefined || (type != "integer" && type != "bigint")) {
    return;
  }
  await session.raw(
    `SELECT setval(sequence.name, GREATEST($3::bigint, COALESCE(pg_sequence_last_value(sequence.name), 1)))
     FROM (SELECT pg_get_serial_sequence($1, $2)::regclass AS name) AS sequence`,
    [quote(metadata.main.name), column, String(key)]
  );
}
