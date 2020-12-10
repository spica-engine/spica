import {Module, Global} from "@nestjs/common";
import {BucketService} from "./bucket.service";
import {SchemaModule} from "@spica-server/core/schema";
import {BucketDataService} from "./bucket-data.service";

@Global()
@Module({
  imports: [SchemaModule.forChild()],
  providers: [BucketService, BucketDataService],
  exports: [BucketService, BucketDataService]
})
export class ServicesModule {}
