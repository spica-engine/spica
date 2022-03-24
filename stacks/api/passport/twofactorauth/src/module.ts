import {Global, Module} from "@nestjs/common";
import {Email, EmailFactorSchemaProvider} from "./email";
// consider removing
import {Question, QuestionFactorSchemaProvider} from "./question";
import { Totp, TotpFactorSchemaProvider } from "./totp";
import {TwoFactorAuth} from "./twofactorauth";

@Global()
@Module({
  providers: [
    {
      provide: TwoFactorAuth,
      useFactory: () => {
        const map = new Map();

        map.set("email", Email);
        map.set("totp", Totp);

        const schemas = [EmailFactorSchemaProvider,TotpFactorSchemaProvider];

        return new TwoFactorAuth(map, schemas);
      }
    }
  ],
  exports: [TwoFactorAuth]
})
export class TwoFactorAuthModule {}
