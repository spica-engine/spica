import {Module, Global} from "@nestjs/common";
import {BucketService} from "./bucket.service";
import {SchemaModule} from "@spica-server/core/schema";

@Global()
@Module({
  imports: [SchemaModule.forChild()],
  providers: [BucketService],
  exports: [BucketService]
})
export class ServicesModule {}
