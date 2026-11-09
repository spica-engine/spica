import {BadRequestException} from "@spica-server/bucket-common";
import {isEncryptedData} from "@spica-server/core-encryption";
import {quote, Session} from "@spica-server/data-postgresql-orm";
import {Bucket} from "@spica-server/interface-bucket";
import {BucketMetadata} from "../schema/index.js";
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

function assertWritable(metadata: BucketMetadata, document: object) {
  const unsupported = metadata.children
    .map(table => table.path)
    .find(path => isPresent(valueAt(document, path)));

  if (unsupported) {
    throw new BadRequestException(
      `The property .${unsupported.join(".")} cannot be written to PostgreSQL yet.`
    );
  }
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

export async function insertRows(
  session: Session,
  bucket: Bucket,
  metadata: BucketMetadata,
  document: object
): Promise<RowSet> {
  assertWritable(metadata, document);
  const key = keyOf(metadata, document);
  const main = await insertMainRow(session, bucket, metadata, document, key);
  await advanceSequence(session, metadata, key);
  return {main, children: {}};
}

async function insertMainRow(
  session: Session,
  bucket: Bucket,
  metadata: BucketMetadata,
  document: object,
  key: unknown
) {
  const table = metadata.main;
  const encrypted = new Set(encryptedPaths(bucket.properties).map(path => path.join("\0")));
  const written = table.columns
    .filter(column => column.name != metadata.primaryKey.column || key !== undefined)
    .map(column => {
      const value = valueAt(document, column.path);
      const isEncrypted =
        encrypted.has(column.path.join("\0")) && value !== undefined && value !== null;
      return {
        name: column.name,
        value: isEncrypted ? encodeEncrypted(column.path, value) : toColumnValue(column, value)
      };
    });

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
