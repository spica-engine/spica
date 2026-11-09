import {fieldTableName, mainTableName} from "@spica-server/data-postgresql";
import {DatabaseService, ObjectId} from "@spica-server/database-testing";
import {PG_POOL} from "@spica-server/interface-data";
import {BucketApp} from "./bucket-app";

const BROKEN = {encrypted: "corrupted", iv: "bad-iv", authTag: "bad-tag"};

export async function corruptEncrypted(
  api: BucketApp,
  bucketId: string,
  documentId: string,
  path: string[]
) {
  if (api.keyField == "id") {
    const pool = api.module.get(PG_POOL, {strict: false});
    await pool.query(
      `UPDATE "${mainTableName(bucketId)}" SET "${path.join("__")}" = $1 WHERE id = $2`,
      [JSON.stringify(BROKEN), documentId]
    );
    return;
  }
  const database = api.module.get(DatabaseService, {strict: false});
  await database.collection(`bucket_${bucketId}`).updateOne(
    {_id: new ObjectId(documentId)},
    {
      $set: Object.fromEntries(
        Object.entries(BROKEN).map(([property, value]) => [`${path.join(".")}.${property}`, value])
      )
    }
  );
}

export async function corruptEncryptedItem(
  api: BucketApp,
  bucketId: string,
  documentId: string,
  field: string,
  position: number
) {
  if (api.keyField == "id") {
    const pool = api.module.get(PG_POOL, {strict: false});
    await pool.query(
      `UPDATE "${fieldTableName(bucketId, [field])}" SET _value = $1 WHERE _parent = $2 AND _position = $3`,
      [JSON.stringify(BROKEN), documentId, position]
    );
    return;
  }
  const database = api.module.get(DatabaseService, {strict: false});
  await database
    .collection(`bucket_${bucketId}`)
    .updateOne({_id: new ObjectId(documentId)}, {$set: {[`${field}.${position}`]: BROKEN}});
}
