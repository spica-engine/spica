import {Global, Module} from "@nestjs/common";
import {Totp, TotpFactorSchemaProvider} from "./totp";
import {AuthFactor} from "./authfactor";
import { ClassCommander } from "@spica-server/replication";

@Global()
@Module({
  providers: [
    {
      provide: AuthFactor,
      useFactory: (cmd) => {
        const map = new Map();

        map.set("totp", Totp);

        const schemas = [TotpFactorSchemaProvider];

        return new AuthFactor(map, schemas,cmd);
      },
      inject:[ClassCommander]
    }
  ],
  exports: [AuthFactor]
})
export class AuthFactorModule {}
