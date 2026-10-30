import {BucketSchemaExtension} from "@spica-server/interface-bucket";
import schema from "./bucket.schema.json" with {type: "json"};
import {bucketKeyKeyword} from "./bucket-key.js";

export * from "./bucket-key.js";

export const postgresBucketSchema: BucketSchemaExtension = {
  schema,
  keywords: [bucketKeyKeyword]
};
