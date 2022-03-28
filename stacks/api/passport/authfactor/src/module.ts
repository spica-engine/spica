import {Global, Module} from "@nestjs/common";
import {Totp, TotpFactorSchemaProvider} from "./totp";
import {AuthFactor} from "./authfactor";

@Global()
@Module({
  providers: [
    {
      provide: AuthFactor,
      useFactory: () => {
        const map = new Map();

        map.set("totp", Totp);

        const schemas = [TotpFactorSchemaProvider];

        return new AuthFactor(map, schemas);
      }
    }
  ],
  exports: [AuthFactor]
})
export class AuthFactorModule {}
