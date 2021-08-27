import {Module} from "@nestjs/common";
import {NestFactory} from "@nestjs/core";
import {ActivityModule} from "@spica-server/activity";
import {BucketModule} from "@spica-server/bucket";
import {Middlewares} from "@spica-server/core";
import {SchemaModule} from "@spica-server/core/schema";
import {CREATED_AT, UPDATED_AT} from "@spica-server/core/schema/defaults";
import {DATE_TIME, OBJECTID_STRING, OBJECT_ID} from "@spica-server/core/schema/formats";
import {WsAdapter} from "@spica-server/core/websocket";
import {DashboardModule} from "@spica-server/dashboard";
import {DatabaseModule} from "@spica-server/database";
import {FunctionModule} from "@spica-server/function";
import {PassportModule} from "@spica-server/passport";
import {PreferenceModule} from "@spica-server/preference";
import {ApiMachineryModule} from "@spica-server/machinery";
import {StatusModule} from "@spica-server/status";
import {StorageModule} from "@spica-server/storage";
import * as fs from "fs";
import * as https from "https";
import * as path from "path";
import * as yargs from "yargs";

const startOptions = require("./start-options.json");

const args: any = yargs
  .options(startOptions.options)
  .demandOption(startOptions.demandOptions)
  .check((args: any) => {
    if (!args["passport-identity-token-expiration-seconds-limit"]) {
      args["passport-identity-token-expiration-seconds-limit"] =
        args["passport-identity-token-expires-in"];
    }

    if (args["bucket-cache"] && args["bucket-cache-ttl"] < 1) {
      throw new TypeError("--bucket-cache-ttl must be a positive number");
    }

    if (
      args["passport-identity-token-expiration-seconds-limit"] <
      args["passport-identity-token-expires-in"]
    ) {
      throw new TypeError(
        `--passport-identity-token-expiration-seconds-limit(${args["passport-identity-token-expiration-seconds-limit"]} seconds) can not be less than --passport-identity-token-expires-in(${args["passport-identity-token-expires-in"]} seconds)`
      );
    }

    if (!args["default-storage-public-url"]) {
      args["default-storage-public-url"] = args["public-url"];
    }

    if (!args["function-api-url"]) {
      args["function-api-url"] = args["public-url"];
    }

    if (
      args["storage-strategy"] == "gcloud" &&
      (!args["gcloud-service-account-path"] || !args["gcloud-bucket-name"])
    ) {
      throw new TypeError(
        "--gcloud-service-account-path and --gcloud-bucket-name options must be present when --storage-strategy is set to 'gcloud'."
      );
    }

    if (args["storage-strategy"] == "default") {
      if (!args["default-storage-path"]) {
        throw new TypeError(
          "--default-storage-path options must be present when --storage-strategy is set to 'default'."
        );
      }

      if (path.isAbsolute(args["default-storage-path"])) {
        throw new TypeError("--default-storage-path must be relative.");
      }
    }

    return true;
  })
  .parserConfiguration({
    "duplicate-arguments-array": false
  })
  .env()
  .parse();

const modules = [
  DashboardModule.forRoot(),
  PreferenceModule,
  ApiMachineryModule,
  DatabaseModule.withConnection(args["database-uri"], {
    database: args["database-name"],
    replicaSet: args["database-replica-set"],
    poolSize: args["database-pool-size"],
    appname: "spica",
    useNewUrlParser: true,
    ["useUnifiedTopology" as any]: true
  }),
  SchemaModule.forRoot({
    formats: [OBJECT_ID, DATE_TIME, OBJECTID_STRING],
    defaults: [CREATED_AT, UPDATED_AT]
  }),
  BucketModule.forRoot({
    hooks: args["bucket-hooks"],
    history: args["bucket-history"],
    realtime: args["experimental-bucket-realtime"],
    cache: args["bucket-cache"],
    cacheTtl: args["bucket-cache-ttl"],
    bucketDataLimit: args["bucket-data-limit"]
  }),
  StorageModule.forRoot({
    strategy: args["storage-strategy"] as "default" | "gcloud",
    defaultPath: path.join(args["persistent-path"], args["default-storage-path"]),
    defaultPublicUrl: args["default-storage-public-url"],
    gcloudServiceAccountPath: args["gcloud-service-account-path"],
    gcloudBucketName: args["gcloud-bucket-name"],
    objectSizeLimit: args["storage-object-size-limit"],
    totalSizeLimit: args["storage-total-size-limit"]
  }),
  PassportModule.forRoot({
    publicUrl: args["public-url"],
    secretOrKey: args["passport-secret"],
    issuer: args["public-url"],
    expiresIn: args["passport-identity-token-expires-in"],
    maxExpiresIn: args["passport-identity-token-expiration-seconds-limit"],
    defaultStrategy: args["passport-default-strategy"],
    entryLimit: args["passport-identity-limit"],
    defaultIdentityPolicies: args["passport-default-identity-policies"],
    defaultIdentityIdentifier: args["passport-default-identity-identifier"],
    defaultIdentityPassword: args["passport-default-identity-password"],
    audience: "spica.io",
    samlCertificateTTL: args["passport-saml-certificate-ttl"]
  }),
  FunctionModule.forRoot({
    logExpireAfterSeconds: args["common-log-lifespan"],
    path: args["persistent-path"],
    databaseName: args["database-name"],
    databaseReplicaSet: args["database-replica-set"],
    databaseUri: args["database-uri"],
    poolSize: args["function-pool-size"],
    poolMaxSize: args["function-pool-maximum-size"],
    apiUrl: args["function-api-url"],
    timeout: args["function-timeout"],
    experimentalDevkitDatabaseCache: args["experimental-function-devkit-database-cache"],
    entryLimit: args["function-limit"],
    corsOptions: {
      allowedOrigins: args["cors-allowed-origins"],
      allowedMethods: args["cors-allowed-methods"],
      allowedHeaders: args["cors-allowed-headers"],
      allowCredentials: args["cors-allow-credentials"]
    }
  })
];

if (args["activity-stream"]) {
  modules.push(ActivityModule.forRoot({expireAfterSeconds: args["common-log-lifespan"]}));
}

if (args["status-tracking"]) {
  modules.push(
    StatusModule.forRoot({
      requestLimit: args["request-limit"],
      expireAfterSeconds: args["common-log-lifespan"]
    })
  );
}

@Module({
  imports: modules
})
class RootModule {}

let httpsOptions: https.ServerOptions;

if (args["cert-file"] && args["key-file"]) {
  httpsOptions = {
    key: fs.readFileSync(args["cert-file"]),
    cert: fs.readFileSync(args["key-file"])
  };
}

NestFactory.create(RootModule, {
  httpsOptions,
  bodyParser: false,
  logger: false
})
  .then(app => {
    app.useWebSocketAdapter(new WsAdapter(app));
    app.use(
      Middlewares.Preflight({
        allowedOrigins: args["cors-allowed-origins"],
        allowedMethods: args["cors-allowed-methods"],
        allowedHeaders: args["cors-allowed-headers"],
        allowCredentials: args["cors-allow-credentials"]
      }),
      Middlewares.JsonBodyParser({
        limit: args["payload-size-limit"],
        ignoreUrls: [/$\/storage/]
      }),
      Middlewares.MergePatchJsonParser(args["payload-size-limit"])
    );
    return app.listen(args.port);
  })
  .then(() => {
    console.log(`: APIs are ready on port ${args.port}`);
  });
