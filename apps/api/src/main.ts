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
import {StatusModule} from "@spica-server/status";
import {StorageModule} from "@spica-server/storage";
import {VersionControlModule} from "@spica-server/versioncontrol";
import {ReplicationModule} from "@spica-server/replication";
import {AssetModule} from "@spica-server/asset";
import {EnvVarsModule} from "@spica-server/env_var";
import fs from "fs";
import https from "https";
import path from "path";
import yargs from "yargs/yargs";
import morgan from "morgan";

const args = yargs(process.argv.slice(2))
  /* TLS Options */
  .options({
    "cert-file": {
      string: true,
      description: "Path to the client server TLS cert file."
    },
    "key-file": {
      string: true,
      description: "Path to the client server TLS key file."
    }
  })
  /* Database Options */
  .options({
    "database-uri": {
      string: true,
      description: "MongoDB connection url."
    },
    "database-name": {
      string: true,
      description: "Name of the database."
    },
    "database-replica-set": {
      string: true,
      alias: ["replica-set"],
      description: "Name of the replica set."
    },
    "database-pool-size": {
      number: true,
      description: "Amount of connection that will be opened against database.",
      default: 50
    }
  })
  .demandOption("database-name")
  .demandOption("database-uri")
  /* Feature Toggling: Bucket and Activity Stream */
  .options({
    "bucket-cache": {
      boolean: true,
      description: "It will reduce bucket-data response time significantly when enabled.",
      default: false
    },
    "bucket-cache-ttl": {
      number: true,
      description: "Lifespan of the bucket-data response caches. Unit: second",
      default: 60
    },
    "activity-stream": {
      boolean: true,
      description: "Whether Activity Stream feature is enabled.",
      default: true
    },
    "bucket-hooks": {
      boolean: true,
      description: "Whether Bucket Hooks feature is enabled.",
      default: true
    },
    "bucket-history": {
      boolean: true,
      description: "Whether Bucket History feature is enabled.",
      default: true
    },
    "experimental-bucket-realtime": {
      boolean: true,
      description: "Whether the experimental Bucket realtime feature is enabled.",
      default: true
    },
    "bucket-data-limit": {
      number: true,
      description: "Maximum document count in all bucket-data collections."
    },
    "bucket-graphql": {
      boolean: true,
      description: "Whether Bucket GraphQL feature is enabled.",
      default: false
    }
  })
  /* Passport Options  */
  .options({
    "passport-secret": {
      string: true,
      alias: ["secret"],
      description: "PEM-encoded public key (asymmetric) for verifying the JWT token's signature."
    },
    "passport-saml-certificate-ttl": {
      number: true,
      description: "Lifespan of the self-signed certificate in seconds.",
      default: Number.MAX_SAFE_INTEGER
    },
    "passport-identity-token-expires-in": {
      number: true,
      description: "Default lifespan of the issued JWT tokens. Unit: second",
      default: 60 * 60 * 24 * 2
    },
    "passport-identity-token-expiration-seconds-limit": {
      number: true,
      description: "Maximum lifespan of the requested JWT token can have. Unit: second"
    },
    "passport-default-identity-identifier": {
      string: true,
      description: "Identifier of the default identity.",
      default: "spica"
    },
    "passport-default-strategy": {
      string: true,
      description: "The default startegy to authenticate identities.",
      default: "IDENTITY",
      choices: ["IDENTITY", "APIKEY"]
    },
    "passport-default-identity-password": {
      string: true,
      description: "Password of the default account.",
      default: "spica"
    },
    "passport-default-identity-policies": {
      array: true,
      description: "Policies to attach to the default identity.",
      default: [
        "ApiKeyFullAccess",
        "IdentityFullAccess",
        "StrategyFullAccess",
        "PolicyFullAccess",
        "PassportFullAccess",
        "ActivityFullAccess",
        "StorageFullAccess",
        "FunctionFullAccess",
        "BucketFullAccess",
        "DashboardFullAccess",
        "WebhookFullAccess",
        "PreferenceFullAccess",
        "StatusFullAccess",
        "AssetFullAccess",
        "VersionControlFullAccess"
      ]
    },
    "passport-identity-limit": {
      number: true,
      description: "Maximum number of identity that can be inserted."
    }
  })
  .demandOption("passport-secret")
  /* Function Options */
  .options({
    "function-api-url": {
      string: true,
      description:
        "Internally or publicly accessible url of the api. This value will be used by various devkit packages such as @spica-devkit/bucket and @spica-devkit/dashboard. Defaults to value of --public-url if not present."
    },
    "function-timeout": {
      number: true,
      description: "Amount of time in seconds that has to elapse before aborting a function.",
      default: 60
    },
    "experimental-function-devkit-database-cache": {
      boolean: true,
      description: "When true, @spica-devkit/database will be cached and run significantly fast.",
      default: false
    },
    "function-limit": {
      number: true,
      description: "Maximum number of function that can be inserted."
    },
    "function-worker-concurrency": {
      number: true,
      description:
        "Maximum number of worker than can run paralel for the same functions. Default value is two.",
      default: 2
    },
    "function-debug": {
      boolean: true,
      description: "Enable/disable function workers debugging mode. Default value is true",
      default: false
    },
    "function-realtime-logs": {
      boolean: true,
      description: "Enable/disable tracking function logs realtime. Default value is false.",
      default: true
    },
    "function-logger": {
      boolean: true,
      description: "Allows keeping logs with their levels like DEBUG, INFO, WARN, ERROR etc.",
      default: true
    },
    "function-invocation-logs": {
      boolean: true,
      description: "Log function invocations to the stdout.",
      default: false
    }
  })
  /* Storage Options */
  .option({
    "storage-strategy": {
      string: true,
      description:
        "Cloud Storage service to store documents. Available options are default, gcloud and awss3.",
      default: "default",
      choices: ["default", "gcloud", "awss3"]
    },
    "default-storage-path": {
      string: true,
      description:
        "A relative path to --persistent-path that will be used to store storage objects.",
      default: "storage"
    },
    "default-storage-public-url": {
      string: true,
      description:
        "Publicly accessible url of the storage. This value will be used by storage to generate urls to objects. Defaults to --public-url if not present."
    },
    "gcloud-service-account-path": {
      string: true,
      description: "Path for the service account file to authorize on google cloud services."
    },
    "gcloud-bucket-name": {
      string: true,
      description: "Name of the bucket to store documents on GCS."
    },
    "awss3-credentials-path": {
      string: true,
      description: "Path for the credentials file to authorize on aws."
    },
    "awss3-bucket-name": {
      string: true,
      description: "Name of the bucket to store documents on AWS S3."
    },
    "storage-object-size-limit": {
      number: true,
      description: "Maximum size in Mi that an object could be.",
      default: 35
    },
    "storage-total-size-limit": {
      number: true,
      description: "Total size limit of storage. Unit: Mb"
    }
  })
  /* Status Options */
  .options({
    "status-tracking": {
      boolean: true,
      description:
        "When enabled, server will be able to show the stats of core modules and track the request-response stats too.",
      default: true
    }
  })
  /* Version Control Options */
  .options({
    "version-control": {
      boolean: true,
      description:
        "When enabled, server will track version of changes and there will be appliable commands to manage these versions.",
      default: true
    }
  })
  /* Replication Options */
  .options({
    replication: {
      boolean: true,
      description: "When enabled, server will keep all API replicas at the same level.",
      default: false
    }
  })
  /* CORS Options */
  .option({
    "cors-allowed-origins": {
      array: true,
      description: "Access-Control-Allow-Origin.",
      default: ["*"]
    },
    "cors-allowed-methods": {
      array: true,
      description: "Access-Control-Allow-Methods",
      default: ["*"]
    },
    "cors-allowed-headers": {
      array: true,
      description: "Access-Control-Allow-Headers",
      default: ["Authorization", "Content-Type", "Accept-Language"]
    },
    "cors-allow-credentials": {
      boolean: true,
      description: "Access-Control-Allow-Credentials",
      default: true
    }
  })
  /* Common Options */
  .option("payload-size-limit", {
    number: true,
    description: "Maximum size in Mi that a body could be.",
    default: 15
  })
  .option("common-log-lifespan", {
    number: true,
    description: "Seconds that need to be passed to expire logs. Default value is one month.",
    default: 30 * 24 * 60 * 60
  })
  .option("port", {
    number: true,
    alias: ["p"],
    default: 80,
    description: "A port to listen on."
  })
  .option("persistent-path", {
    string: true,
    default: "/tmp",
    normalize: true,
    description: "A path that will be used by API to store persistent data."
  })
  .option("public-url", {
    string: true,
    description: "Publicly accessible url of the APIs.",
    alias: ["public-host"],
    describe: `This option will be used by various modules. 
For instance the 'storage' module will use this url to generate object links that are accessible from egress networks
While the 'passport' module will use this url to re-route the user to the Passport APIs.

Example: http(s)://doomed-d45f1.spica.io/api`
  })
  .demandOption("public-url")
  .option("access-logs", {
    boolean: true,
    description: "Enable/disable http access logs",
    default: false
  })
  .option("access-logs-url-filter", {
    string: true,
    description: "Regex to filter access logs by url",
    default: ".*"
  })
  .option("access-logs-statuscode-filter", {
    string: true,
    description: "Regex to filter access logs by status code",
    default: ".*"
  })
  .middleware(args => {
    const username = process.env.MONGODB_USERNAME;
    const password = process.env.MONGODB_PASSWORD;

    if (username && password) {
      const uri = new URL(args["database-uri"]);

      uri.username = encodeURIComponent(username);
      uri.password = encodeURIComponent(password);

      args["database-uri"] = uri.toString();
    }
  })
  .check(args => {
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

    if (args["function-worker-concurrency"] < 1) {
      throw new TypeError("--function-worker-concurrency must be a positive number");
    }

    if (
      args["storage-strategy"] == "gcloud" &&
      (!args["gcloud-service-account-path"] || !args["gcloud-bucket-name"])
    ) {
      throw new TypeError(
        "--gcloud-service-account-path and --gcloud-bucket-name options must be present when --storage-strategy is set to 'gcloud'."
      );
    }

    if (
      args["storage-strategy"] == "awss3" &&
      (!args["awss3-credentials-path"] || !args["awss3-bucket-name"])
    ) {
      throw new TypeError(
        "--awss3-credentials-path and --awss3-bucket-name options must be present when --storage-strategy is set to 'awss3'."
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
  PreferenceModule.forRoot(),
  AssetModule.forRoot({persistentPath: args["persistent-path"]}),
  DatabaseModule.withConnection(args["database-uri"], {
    database: args["database-name"],
    replicaSet: args["database-replica-set"],
    maxPoolSize: args["database-pool-size"],
    appName: "spica"
  }),
  EnvVarsModule.forRoot(),
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
    bucketDataLimit: args["bucket-data-limit"],
    graphql: args["bucket-graphql"]
  }),
  StorageModule.forRoot({
    strategy: args["storage-strategy"] as "default" | "gcloud" | "awss3",
    defaultPath: path.join(args["persistent-path"], args["default-storage-path"]),
    defaultPublicUrl: args["default-storage-public-url"],
    gcloudServiceAccountPath: args["gcloud-service-account-path"],
    gcloudBucketName: args["gcloud-bucket-name"],
    awss3CredentialsPath: args["awss3-credentials-path"],
    awss3BucketName: args["awss3-bucket-name"],
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
    apiUrl: args["function-api-url"],
    timeout: args["function-timeout"],
    experimentalDevkitDatabaseCache: args["experimental-function-devkit-database-cache"],
    entryLimit: args["function-limit"],
    corsOptions: {
      allowedOrigins: args["cors-allowed-origins"],
      allowedMethods: args["cors-allowed-methods"],
      allowedHeaders: args["cors-allowed-headers"],
      allowCredentials: args["cors-allow-credentials"]
    },
    debug: args["function-debug"],
    maxConcurrency: args["function-worker-concurrency"],
    realtimeLogs: args["function-realtime-logs"],
    logger: args["function-logger"],
    invocationLogs: args["function-invocation-logs"]
  })
];

if (args["activity-stream"]) {
  modules.push(ActivityModule.forRoot({expireAfterSeconds: args["common-log-lifespan"]}));
}

if (args["status-tracking"]) {
  modules.push(
    StatusModule.forRoot({
      expireAfterSeconds: args["common-log-lifespan"]
    })
  );
}

if (args["version-control"]) {
  modules.push(
    VersionControlModule.forRoot({
      persistentPath: args["persistent-path"],
      isReplicationEnabled: args["replication"]
    })
  );
}

if (args["replication"]) {
  modules.push(ReplicationModule.forRoot());
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
  bodyParser: false
}).then(async app => {
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
  app.enableShutdownHooks();

  if (args["access-logs"]) {
    morgan.token("prefix", () => "access-log:");
    app.use(
      morgan(
        ':prefix :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length]',
        {
          skip: (req, res) => {
            const urlRegex = new RegExp(args["access-logs-url-filter"]);
            const statusCodeRegex = new RegExp(args["access-logs-statuscode-filter"]);
            return !urlRegex.test(req.url) || !statusCodeRegex.test(res.statusCode.toString());
          }
        }
      )
    );
  }

  const {port} = await args;
  await app.listen(port);
  console.log(`: APIs are ready on port ${port}`);
});
