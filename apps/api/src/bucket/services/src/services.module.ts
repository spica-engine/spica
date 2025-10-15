import {Module, Global, DynamicModule} from "@nestjs/common";
import {BucketService} from "./bucket.service";
import {SchemaModule} from "@spica-server/core/schema";
import {BucketDataService} from "./bucket-data.service";
import {BUCKET_DATA_LIMIT, BUCKET_DATA_HASHING_KEY} from "@spica-server/interface/bucket";

@Global()
@Module({})
export class ServicesModule {
  static initialize(bucketDataLimit: number, hashingKey?: string): DynamicModule {
    return {
      module: ServicesModule,
      imports: [SchemaModule.forChild()],
      providers: [
        {provide: BUCKET_DATA_LIMIT, useValue: bucketDataLimit},
        {provide: BUCKET_DATA_HASHING_KEY, useValue: hashingKey},
        BucketService,
        BucketDataService
      ],
      exports: [BucketService, BucketDataService, BUCKET_DATA_HASHING_KEY]
    };
  }
}
