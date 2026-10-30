import {Module, Global, DynamicModule} from "@nestjs/common";
import {BucketService} from "./bucket.service.js";
import {BucketChangeDispatcher} from "./change-dispatcher.js";
import {SchemaModule} from "@spica-server/core-schema";
import {
  BUCKET_DATA_LIMIT,
  BUCKET_DATA_HASH_SECRET,
  BUCKET_DATA_ENCRYPTION_SECRET,
  BUCKET_DATA_REPOSITORY,
  BUCKET_REPOSITORY,
  BUCKET_SCHEMA_MANAGER
} from "@spica-server/interface-bucket";
import {provideRepository} from "@spica-server/data";

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
        BucketChangeDispatcher,
        provideRepository(BUCKET_REPOSITORY),
        provideRepository(BUCKET_DATA_REPOSITORY),
        provideRepository(BUCKET_SCHEMA_MANAGER),
        BucketService
      ],
      exports: [
        BucketChangeDispatcher,
        BucketService,
        BUCKET_REPOSITORY,
        BUCKET_DATA_REPOSITORY,
        BUCKET_DATA_LIMIT,
        BUCKET_DATA_HASH_SECRET,
        BUCKET_DATA_ENCRYPTION_SECRET
      ]
    };
  }
}
