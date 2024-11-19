import {
  BucketDataService,
  BucketService,
  getBucketDataCollection
} from "@spica/api/src/bucket/services";
import {register, Status} from "@spica/api/src/status";

export async function registerStatusProvider(bs: BucketService, bds: BucketDataService) {
  const provide = async () => {
    const status: Status = {
      module: "bucket",
      status: {
        buckets: await bs.getStatus(),
        bucketData: await bds.getStatus()
      }
    };

    const bucketSchemas = await bs.find();
    for (const schema of bucketSchemas) {
      const bdsCol = bds.children(schema);

      const bucketName = getBucketDataCollection(schema._id);
      status.status[bucketName] = await bdsCol.getStatus();
    }

    return status;
  };

  register({module: "bucket", provide});
}
