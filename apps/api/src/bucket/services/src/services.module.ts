import {Module, Global, DynamicModule} from "@nestjs/common";
import {BucketService} from "./bucket.service";
import {SchemaModule} from "@spica-server/core/schema";
import {BucketDataService} from "./bucket-data.service";
import {BUCKET_DATA_LIMIT} from "@spica-server/interface/bucket/services";

@Global()
@Module({})
export class ServicesModule {
  static initialize(bucketDataLimit: number): DynamicModule {
    return {
      module: ServicesModule,
      imports: [SchemaModule.forChild()],
      providers: [
        {provide: BUCKET_DATA_LIMIT, useValue: bucketDataLimit},
        BucketService,
        BucketDataService
      ],
      exports: [BucketService, BucketDataService]
    };
  }
}
