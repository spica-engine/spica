import {Module} from "@nestjs/common";
import {BucketService} from "./bucket.service";
import {SchemaModule} from "@spica-server/core/schema";

@Module({
  imports: [SchemaModule.forChild()],
  providers: [BucketService],
  exports: [BucketService]
})
export class BucketServiceModule {}
