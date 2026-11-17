import {Global, Module} from "@nestjs/common";
import {SecretService, SECRET_ENCRYPTION_SECRET} from "./service.js";
import {SecretChangeDispatcher} from "./change-dispatcher.js";
import {decrypt} from "@spica-server/core-encryption";
import {
  Secret,
  DecryptedSecret,
  SECRET_DECRYPTOR,
  SECRET_REPOSITORY
} from "@spica-server/interface-secret";
import {provideRepository} from "@spica-server/data";

@Global()
@Module({})
export class ServicesModule {
  static forRoot(options: {encryptionSecret: string}) {
    return {
      module: ServicesModule,
      providers: [
        SecretChangeDispatcher,
        provideRepository(SECRET_REPOSITORY),
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
      exports: [SecretChangeDispatcher, SecretService, SECRET_DECRYPTOR]
    };
  }
}
