import {BucketModule} from "@spica-server/bucket";
import {DatabaseModule} from "@spica-server/database";
import {FunctionModule} from "@spica-server/function";
import {PassportModule} from "@spica-server/passport";
import {PreferenceModule} from "@spica-server/preference";
import {StorageModule} from "@spica-server/storage";
import {ComposerModule} from "@spica-server/composer";
import {Module} from "@nestjs/common";

@Module({
  imports: [
    DatabaseModule.withConnection(process.env.DATABASE_URI, {
      database: process.env.DATABASE_NAME,
      replicaSet: process.env.REPLICA_SET
    }),
    PreferenceModule,
    BucketModule,
    StorageModule.forRoot({
      path: process.env.PERSISTENT_PATH
    }),
    PassportModule.forRoot({
      secretOrKey: "$2b$10$shOzfYpDCy.RMgsVlwdQeONKGGzaBTfTQAjmXQNpMp4aKlLXrfZ/C",
      issuer: process.env.PUBLIC_HOST,
      audience: "spica.io"
    }),
    FunctionModule.forRoot({
      path: process.env.PERSISTENT_PATH
    }),
    ComposerModule.forRoot({
      path: process.env.PERSISTENT_PATH,
      serverUrl: process.env.PUBLIC_HOST
    })
  ]
})
export class AppModule {}
