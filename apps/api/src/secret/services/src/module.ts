import {Global, Module} from "@nestjs/common";
import {SecretService, SECRET_ENCRYPTION_SECRET} from "./service";
import {decrypt} from "@spica-server/core/encryption";
import {Secret, DecryptedSecret, SECRET_DECRYPTOR} from "@spica-server/interface/secret";

@Global()
@Module({})
export class ServicesModule {
  static forRoot(options: {encryptionSecret: string}) {
    return {
      module: ServicesModule,
      providers: [
        SecretService,
        {
          provide: SECRET_ENCRYPTION_SECRET,
          useValue: options.encryptionSecret
        },
        {
          provide: SECRET_DECRYPTOR,
          useValue: (secret: Secret): DecryptedSecret => {
            return {
              ...secret,
              value: decrypt(secret.value, options.encryptionSecret)
            };
          }
        }
      ],
      exports: [SecretService, SECRET_DECRYPTOR]
    };
  }
}
