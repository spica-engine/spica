import {BucketSchemaExtension} from "@spica-server/interface-bucket";
import schema from "./bucket.schema.json" with {type: "json"};

export const mongoBucketSchema: BucketSchemaExtension = {schema};
