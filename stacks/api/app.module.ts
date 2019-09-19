import {Module} from "@nestjs/common";
import {BucketModule} from "@spica-server/bucket";
import {ComposerModule} from "@spica-server/composer";
import {SchemaModule} from "@spica-server/core/schema";
import {DatabaseModule} from "@spica-server/database";
import {FunctionModule} from "@spica-server/function";
import {PassportModule} from "@spica-server/passport";
import {PreferenceModule} from "@spica-server/preference";
import {StorageModule} from "@spica-server/storage";
import {CREATED_AT, OBJECT_ID, UPDATED_AT} from "./defaults";

@Module({
  imports: [
    DatabaseModule.withConnection(process.env.DATABASE_URI, {
      database: process.env.DATABASE_NAME,
      replicaSet: process.env.REPLICA_SET
    }),
    SchemaModule.forRoot({
      formats: [OBJECT_ID],
      defaults: [CREATED_AT, UPDATED_AT]
    }),
    PreferenceModule,
    BucketModule,
    StorageModule.forRoot({
      path: process.env.PERSISTENT_PATH
    }),
    PassportModule.forRoot({
      secretOrKey: process.env.SECRET,
      issuer: process.env.PUBLIC_HOST,
      defaultPassword: process.env.DEFAULT_PASSWORD,
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
