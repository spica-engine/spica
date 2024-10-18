import {Global, Module} from "@nestjs/common";
import {Totp, TotpFactorSchemaProvider} from "./totp";
import {AuthFactor} from "./authfactor";
import {ClassCommander} from "@spica-server/replication";

@Global()
@Module({
  providers: [
    {
      provide: "FACTORS_MAP",
      useValue: new Map([
        [
          "totp",
          {instanceFactory: meta => new Totp(meta), schemaProvider: TotpFactorSchemaProvider}
        ]
      ])
    },
    {
      provide: AuthFactor,
      useClass: AuthFactor
    }
  ],
  exports: [AuthFactor]
})
export class AuthFactorModule {}
