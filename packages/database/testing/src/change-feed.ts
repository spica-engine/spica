import {Global, Module} from "@nestjs/common";
import {CHANGE_FEED} from "@spica-server/interface-data";
import {NEVER} from "rxjs";

@Global()
@Module({
  providers: [{provide: CHANGE_FEED, useValue: {watch: () => NEVER}}],
  exports: [CHANGE_FEED]
})
export class QuietChangeFeedModule {}
