import {BucketService, getBucketDataCollection} from "@spica-server/bucket-services";
import {register} from "@spica-server/status";
import {Status} from "@spica-server/interface-status";
import {BucketDataRepository, BucketRepository} from "@spica-server/interface-bucket";

export async function registerStatusProvider(
  bs: BucketService,
  buckets: BucketRepository,
  bucketData: BucketDataRepository
) {
  const provide = async () => {
    const status: Status = {
      module: "bucket",
      status: {
        buckets: await buckets.status(),
        bucketData: await bucketData.status()
      }
    };

    const bucketSchemas = await bs.findAll();
    for (const schema of bucketSchemas) {
      const bucketName = getBucketDataCollection(schema._id);
      status.status[bucketName] = await bucketData.statusOf(schema);
    }

    return status;
  };

  register({module: "bucket", provide});
}
