import {Module, Global} from "@nestjs/common";
import {PassportModule} from "@nestjs/passport";
import {NoopStrategy} from "./noop.strategy";

@Global()
@Module({
  imports: [PassportModule.register({defaultStrategy: "noop", session: false})],
  exports: [PassportModule],
  providers: [NoopStrategy]
})
export class PassportTestingModule {}
