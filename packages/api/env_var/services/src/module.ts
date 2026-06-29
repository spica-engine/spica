import {Global, Module} from "@nestjs/common";
import {EnvVarService} from "./service.js";
import {EnvVarChangeDispatcher} from "./change-dispatcher.js";

// EnvVarService is re-provided by every module that needs it (EnvVarModule, function services),
// so the dispatcher lives on the static @Global module — imported by class reference and therefore
// registered once — to stay a single shared bus those instances all dispatch to and watch.
@Global()
@Module({
  providers: [EnvVarChangeDispatcher],
  exports: [EnvVarChangeDispatcher]
})
export class ServicesModule {
  static forRoot() {
    return {
      module: ServicesModule,
      providers: [EnvVarChangeDispatcher, EnvVarService],
      exports: [EnvVarChangeDispatcher, EnvVarService]
    };
  }
}
