import {Module, Global, DynamicModule} from "@nestjs/common";
import {BucketService} from "./bucket.service";
import {SchemaModule} from "../../../../../../libs/core/schema";
import {BucketDataService} from "./bucket-data.service";
import {BUCKET_DATA_LIMIT} from "../../../../../../libs/interface/bucket";

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
