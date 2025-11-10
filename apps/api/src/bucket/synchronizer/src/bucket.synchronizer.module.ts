import {Module} from "@nestjs/common";

@Module({})
export class BucketSynchronizerModule {
  static register() {
    return {
      module: BucketSynchronizerModule,
      imports: [],
      providers: []
    };
  }
}
