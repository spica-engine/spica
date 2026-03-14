import {Module, Global, DynamicModule} from "@nestjs/common";
import {BucketService} from "./bucket.service";
import {SchemaModule} from "@spica-server/core/schema";
import {BucketDataService} from "./bucket-data.service";
import {
  BUCKET_DATA_LIMIT,
  BUCKET_DATA_HASH_SECRET,
  BUCKET_DATA_ENCRYPTION_SECRET
} from "@spica-server/interface/bucket";

@Global()
@Module({})
export class ServicesModule {
  static initialize(
    bucketDataLimit: number,
    hashSecret?: string,
    encryptionSecret?: string
  ): DynamicModule {
    return {
      module: ServicesModule,
      imports: [SchemaModule.forChild()],
      providers: [
        {provide: BUCKET_DATA_LIMIT, useValue: bucketDataLimit},
        {provide: BUCKET_DATA_HASH_SECRET, useValue: hashSecret},
        {provide: BUCKET_DATA_ENCRYPTION_SECRET, useValue: encryptionSecret},
        BucketService,
        BucketDataService
      ],
      exports: [
        BucketService,
        BucketDataService,
        BUCKET_DATA_HASH_SECRET,
        BUCKET_DATA_ENCRYPTION_SECRET
      ]
    };
  }
}
