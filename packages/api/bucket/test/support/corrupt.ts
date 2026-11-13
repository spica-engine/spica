import {BUCKET_WRITE, BucketWriteFacade} from "@spica-server/interface-bucket-common";
import {BucketApp} from "./bucket-app";

const BROKEN = {encrypted: "corrupted", iv: "bad-iv", authTag: "bad-tag"};

function withValueAt(document: Record<string, any>, path: string[], value: unknown) {
  const [head, ...rest] = path;
  return {
    ...document,
    [head]: rest.length ? withValueAt(document[head] ?? {}, rest, value) : value
  };
}

async function overwrite(
  api: BucketApp,
  bucketId: string,
  documentId: string,
  change: (stored: Record<string, any>) => Record<string, any>
) {
  const bucket = (await api.req.get(`/bucket/${bucketId}`)).body;
  const stored = await api.stored(bucketId, documentId);
  const patch = change(stored);
  await api.module
    .get<BucketWriteFacade>(BUCKET_WRITE, {strict: false})
    .patch(bucket, {...stored, ...patch}, patch, {}, {resolveSchema: () => bucket});
}

export function corruptEncrypted(
  api: BucketApp,
  bucketId: string,
  documentId: string,
  path: string[]
) {
  return overwrite(api, bucketId, documentId, stored => {
    const [head, ...rest] = path;
    return {[head]: rest.length ? withValueAt(stored[head], rest, BROKEN) : BROKEN};
  });
}

export function corruptEncryptedItem(
  api: BucketApp,
  bucketId: string,
  documentId: string,
  field: string,
  position: number
) {
  return overwrite(api, bucketId, documentId, stored => ({
    [field]: stored[field].map((item: unknown, index: number) =>
      index == position ? BROKEN : item
    )
  }));
}
