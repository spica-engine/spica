import {Global, Module} from "@nestjs/common";
import {TestingModule} from "@nestjs/testing";
import {CHANGE_FEED} from "@spica-server/interface-data";
import {NEVER} from "rxjs";
import {stream} from "./watch-shim";

@Global()
@Module({
  providers: [{provide: CHANGE_FEED, useValue: {watch: () => NEVER}}],
  exports: [CHANGE_FEED]
})
export class QuietChangeFeedModule {}

const MONGODB_STREAM_START_MS = 400;

export async function changeFeedReady(module: TestingModule) {
  const feed = module.get<{ready?: () => Promise<void>}>(CHANGE_FEED);
  if (feed.ready) {
    await feed.ready();
    return;
  }
  await stream.wait();
  await new Promise(resolve => setTimeout(resolve, MONGODB_STREAM_START_MS));
}
