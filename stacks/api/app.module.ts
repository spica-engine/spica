import {Module} from "@nestjs/common";
import {BucketModule} from "@spica-server/bucket";
import {SchemaModule} from "@spica-server/core/schema";
import {DatabaseModule} from "@spica-server/database";
import {FunctionModule} from "@spica-server/function";
import {PassportModule} from "@spica-server/passport";
import {PreferenceModule} from "@spica-server/preference";
import {StorageModule} from "@spica-server/storage";
import {CREATED_AT, OBJECT_ID, UPDATED_AT} from "./defaults";
import {DashboardModule} from "@spica-server/dashboard/dashboard.module";
import {ActivityModule} from "./activity/activity.module";

@Module({
  imports: [
    DatabaseModule.withConnection(process.env.DATABASE_URI, {
      database: process.env.DATABASE_NAME,
      replicaSet: process.env.REPLICA_SET,
      poolSize: Number(process.env.POOL_SIZE || 50)
    }),
    SchemaModule.forRoot({
      formats: [OBJECT_ID],
      defaults: [CREATED_AT, UPDATED_AT]
    }),
    PreferenceModule,
    ...(!!process.env.ENABLE_ACTIVITY_STREAM ? [ActivityModule] : []),
    BucketModule.forRoot({hooks: !!process.env.ENABLE_BUCKET_HOOKS}),
    DashboardModule,
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
    })
  ]
})
export class AppModule {}
