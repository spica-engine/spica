import {Global, Module} from "@nestjs/common";
import {SecretService, SECRET_ENCRYPTION_SECRET} from "./service";
import {decrypt} from "@spica-server/core/encryption";
import {
  Secret,
  DecryptedSecret,
  HiddenSecret,
  SECRET_DECRYPTOR,
  SecretDecryptor
} from "@spica-server/interface/secret";

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
          useFactory: (): SecretDecryptor => ({
            decrypt(secret: Secret): DecryptedSecret {
              return {
                _id: secret._id,
                key: secret.key,
                value: decrypt(secret.value, options.encryptionSecret)
              };
            },
            hideValue(secret: Secret): HiddenSecret {
              return {
                _id: secret._id,
                key: secret.key
              };
            }
          })
        }
      ],
      exports: [SecretService, SECRET_DECRYPTOR]
    };
  }
}
