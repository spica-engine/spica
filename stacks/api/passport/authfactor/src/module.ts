import {Global, Module} from "@nestjs/common";
import {Email, EmailFactorSchemaProvider} from "./email";
// consider removing
import {Question, QuestionFactorSchemaProvider} from "./question";
import { Totp, TotpFactorSchemaProvider } from "./totp";
import {AuthFactor} from "./authfactor";

@Global()
@Module({
  providers: [
    {
      provide: AuthFactor,
      useFactory: () => {
        const map = new Map();

        map.set("email", Email);
        map.set("totp", Totp);

        const schemas = [EmailFactorSchemaProvider,TotpFactorSchemaProvider];

        return new AuthFactor(map, schemas);
      }
    }
  ],
  exports: [AuthFactor]
})
export class AuthFactorModule {}
