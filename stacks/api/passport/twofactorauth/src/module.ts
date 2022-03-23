import {Global, Module} from "@nestjs/common";
import {Email, EmailFactorSchemaProvider} from "./email";
import {Question, QuestionFactorMeta, QuestionFactorSchemaProvider} from "./question";
import {TwoFactorAuth} from "./twofactorauth";

@Global()
@Module({
  providers: [
    {
      provide: TwoFactorAuth,
      useFactory: () => {
        const map = new Map();

        map.set("email", Email);
        map.set("question", Question);

        const schemas = [EmailFactorSchemaProvider, QuestionFactorSchemaProvider];

        return new TwoFactorAuth(map, schemas);
      }
    }
  ],
  exports: [TwoFactorAuth]
})
export class TwoFactorAuthModule {}
