import {Logger, Module} from "@nestjs/common";
import {NestFactory} from "@nestjs/core";
import {ActivityModule} from "@spica-server/activity";
import {BucketModule} from "@spica-server/bucket";
import {Middlewares} from "@spica-server/core";
import {SchemaModule} from "@spica-server/core-schema";
import {CREATED_AT, UPDATED_AT} from "@spica-server/core-schema";
import {DATE_TIME, OBJECTID_STRING, OBJECT_ID} from "@spica-server/core-schema";
import {WsAdapter} from "@spica-server/core-websocket";
import {DashboardModule} from "@spica-server/dashboard";
import {DatabaseModule} from "@spica-server/database";
import {FunctionModule} from "@spica-server/function";
import {PassportModule} from "@spica-server/passport";
import {PreferenceModule} from "@spica-server/preference";
import {StatusModule} from "@spica-server/status";
import {StorageModule} from "@spica-server/storage";
import {ReplicationModule} from "@spica-server/replication";
import {AssetModule} from "@spica-server/asset";
import {BatchModule} from "@spica-server/batch";
import {EnvVarModule} from "@spica-server/env_var";
import {SecretModule} from "@spica-server/secret";
import {MailerModule} from "@spica-server/mailer";
import {SmsModule} from "@spica-server/sms";

import fs from "fs";
import https from "https";
import os from "os";
import path from "path";
import yargs from "yargs/yargs";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import {ConfigModule} from "@spica-server/config";
import {deriveKey} from "@spica-server/core-encryption";

const yargsInstance = yargs(process.argv.slice(2)) as any;

const args = yargsInstance
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
  /* Proxy options */
  .options({
    "trust-proxy": {
      default: true,
      description:
        "Whether to trust the X-Forwarded-* headers set by the proxy. Possible values are true, false, a number representing the number of hops to trust, or a comma-separated list of IPs to trust."
    }
  })
  .coerce("trust-proxy", (arg: any) => {
    if (arg === true || arg === "true") return true;
    if (arg === false || arg === "false") return false;
    const num = Number(arg);
    if (!isNaN(num)) return num;

    if (arg.includes(",")) {
      return arg.split(",").map(v => v.trim());
    }

    return arg;
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
    },
    "database-read-preference": {
      string: true,
      description: "Read preference for the database connection.",
      default: "primary",
      choices: ["primary", "primaryPreferred", "secondary", "secondaryPreferred", "nearest"]
    },
    "database-change-stream-await-time": {
      number: true,
      description:
        "Maximum time in milliseconds for the server to wait for new data before returning an empty change stream batch. Maps to MongoDB maxAwaitTimeMS.",
      default: 1000
    }
  })
  .demandOption("database-name")
  .demandOption("database-uri")
  /* Dashboard Options */
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
    "bucket-data-limit": {
      number: true,
      description: "Maximum document count in all bucket-data collections."
    },
    "bucket-graphql": {
      boolean: true,
      description: "Whether Bucket GraphQL feature is enabled.",
      default: false
    },
    "master-key": {
      string: true,
      description:
        "Master key used to derive all module-specific secrets (hash, encryption, etc) except secrets specifically provided."
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
    "passport-identity-password-history-limit": {
      number: true,
      description:
        "How many of last passwords will be compared with the new password in terms of uniqueness",
      default: 0
    },
    "passport-identity-failed-login-attempt-limit": {
      number: true,
      description: "Maximum failed login attempt before blocking further attempts.",
      default: 0
    },
    "passport-identity-block-duration-after-failed-login-attempts": {
      number: true,
      description: "Duration of blocking login attempts in minutes.",
      default: 0
    },
    "passport-identity-token-expiration-seconds-limit": {
      number: true,
      description: "Maximum lifespan of the requested JWT token can have. Unit: second"
    },
    "passport-identity-refresh-token-expires-in": {
      number: true,
      description: "Default lifespan of the issued refresh JWT tokens. Unit: second",
      default: 60 * 60 * 24 * 3
    },
    "refresh-token-hash-secret": {
      string: true,
      description: "Secret used for hashing refresh tokens before storing in the database"
    },
    "passport-default-identity-identifier": {
      string: true,
      description: "Identifier of the default identity.",
      default: "spica"
    },
    "passport-default-strategy": {
      string: true,
      description: "The default strategy to authenticate identities.",
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
        "ActivityFullAccess",
        "ApiKeyFullAccess",
        "AssetFullAccess",
        "BucketFullAccess",
        "DashboardFullAccess",
        "EnvVarFullAccess",
        "SecretFullAccess",
        "FunctionFullAccess",
        "IdentityFullAccess",
        "PassportFullAccess",
        "PolicyFullAccess",
        "PreferenceFullAccess",
        "RefreshTokenFullAccess",
        "StatusFullAccess",
        "StorageFullAccess",
        "StrategyFullAccess",
        "WebhookFullAccess",
        "UserFullAccess",
        "ConfigFullAccess"
      ]
    },
    "passport-identity-limit": {
      number: true,
      description: "Maximum number of identity that can be inserted."
    },
    "passport-user-token-expires-in": {
      number: true,
      description: "Default lifespan of the issued JWT tokens for users. Unit: second",
      default: 60 * 60 * 24 * 2
    },
    "passport-user-password-history-limit": {
      number: true,
      description:
        "How many of last passwords will be compared with the new password in terms of uniqueness for users",
      default: 0
    },
    "passport-user-failed-login-attempt-limit": {
      number: true,
      description: "Maximum failed login attempt before blocking further attempts for users.",
      default: 0
    },
    "passport-user-block-duration-after-failed-login-attempts": {
      number: true,
      description: "Duration of blocking login attempts in minutes for users.",
      default: 0
    },
    "passport-user-token-expiration-seconds-limit": {
      number: true,
      description: "Maximum lifespan of the requested JWT token can have for users. Unit: second"
    },
    "passport-user-refresh-token-expires-in": {
      number: true,
      description: "Default lifespan of the issued refresh JWT tokens for users. Unit: second",
      default: 60 * 60 * 24 * 3
    },
    "passport-user-limit": {
      number: true,
      description: "Maximum number of users that can be inserted."
    },
    "passport-user-verification-code-expires-in": {
      number: true,
      description: "Default lifespan of the issued verification codes for users. Unit: second",
      default: 60 * 5
    }
  })

  /* Function Options */
  .options({
    "function-api-url": {
      string: true,
      description:
        "URL of the server api to be injected into function workers environment variables. Devkit packages in functions will use this value to connect the server api if not present. Default value is http://127.0.0.1:<port> to support loopback connections to improve performance."
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
    "function-worker-event-concurrency": {
      number: true,
      description:
        "Maximum number of events a single worker process handles concurrently in-process. Default is 1 (one event per worker).",
      default: 1
    },
    "function-warm-workers-max": {
      number: true,
      description:
        "Maximum number of pre-warmed workers a single function may keep on standby. Caps the per-function 'warmWorkers' schema value. Set 0 to disable warm workers. Default value is ten.",
      default: 10
    },
    "function-debug": {
      boolean: true,
      description: "Enable/disable function workers debugging mode. Default value is true",
      default: false
    },
    "function-logger": {
      boolean: true,
      description: "Allows keeping logs with their levels like DEBUG, INFO, WARN, ERROR etc.",
      default: true
    },
    "grpc-function-port": {
      number: true,
      description: "Port for the gRPC trigger server. Default is 50051.",
      default: 50051
    },
    "function-grpc-max-message-size-bytes": {
      number: true,
      description: "Maximum message size in bytes for function runtime communication.",
      default: 25 * 1024 * 1024
    },
    "function-invocation-logs": {
      boolean: true,
      description: "Log function invocations to the stdout.",
      default: false
    },
    "function-worker-log-output": {
      array: true,
      description:
        "Output streams for function worker logs. Accepted values: database, stdout. Defaults to database only.",
      default: ["database"],
      coerce: (value: string | string[]) => {
        const values = Array.isArray(value)
          ? value.flatMap(v => String(v).split(",").map(token => token.trim()))
          : String(value)
              .split(",")
              .map(token => token.trim());
        return [...new Set(values.filter(Boolean))];
      }
    }
  })
  /* Function Asset Storage Options */
  .option({
    "function-asset-storage-strategy": {
      string: true,
      description:
        "Storage strategy for function source assets. Available options are default, awss3, gcs.",
      default: "default",
      choices: ["default", "awss3", "gcs"]
    },
    "function-asset-path": {
      string: true,
      default: path.join(os.tmpdir(), "spica-function-assets"),
      description:
        "Path to store function assets (used when --function-asset-storage-strategy is 'default'). In multi-replica deployments all replicas should point to the same shared path (e.g. an NFS mount)."
    },
    "function-asset-awss3-credentials-path": {
      string: true,
      description:
        "Path to the AWS credentials JSON file ({accessKeyId, secretAccessKey, region}) for function asset storage. Optional; when omitted, the AWS SDK default credential provider chain is used (environment variables, web identity tokens such as EKS IRSA, instance profiles)."
    },
    "function-asset-awss3-bucket-name": {
      string: true,
      description: "Name of the S3 bucket to store function assets."
    },
    "function-asset-gcs-service-account-path": {
      string: true,
      description: "Path to the GCS service account JSON file for function asset storage."
    },
    "function-asset-gcs-bucket-name": {
      string: true,
      description: "Name of the GCS bucket to store function assets."
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
      description:
        "Path for the credentials file to authorize on aws. Optional; when omitted, the AWS SDK default credential provider chain is used (environment variables, web identity tokens such as EKS IRSA, instance profiles)."
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
    },
    "resumable-upload-expires-in": {
      number: true,
      description: "Storage period for unloaded files in milliseconds, default is 2 days",
      default: 1000 * 60 * 60 * 24 * 2 // 2 days
    }
  })
  /* Sms Sender Options */
  .options({
    "sms-sender-strategy": {
      string: true,
      description: "SMS service provider strategy. Default is twilio.",
      default: "twilio",
      choices: ["twilio"]
    },
    "twilio-sms-service-account-sid": {
      string: true,
      description: "Twilio SMS service Account SID."
    },
    "twilio-sms-service-auth-token": {
      string: true,
      description: "Twilio SMS service Auth Token."
    },
    "twilio-sms-service-from-number": {
      string: true,
      description: "Twilio SMS service From Number."
    }
  })
  /* Mailer Options */
  .options({
    "mailer-host": {
      string: true,
      description: "SMTP server host (e.g. smtp.example.com)"
    },
    "mailer-port": {
      number: true,
      description: "SMTP server port (e.g. 587)"
    },
    "mailer-secure": {
      boolean: true,
      description: "Use secure connection (TLS/SSL)",
      default: false
    },
    "mailer-user": {
      string: true,
      description: "SMTP auth user"
    },
    "mailer-pass": {
      string: true,
      description: "SMTP auth password"
    },
    "mailer-from": {
      string: true,
      description: "Default From address for outgoing mails"
    }
  })
  /* Status Options */
  .options({
    "http-status-tracking": {
      boolean: true,
      description:
        "When enabled, server will track the request-response stats like request count, request size, and response size.",
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
  /* Additional Header Options */
  .option({
    "cache-control-header": {
      string: true,
      description: "Cache-Control"
    },
    "x-frame-options-header": {
      string: true,
      description: "X-Frame-Option"
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

    const masterKey = process.env.MASTER_KEY;
    if (masterKey) args["master-key"] = masterKey;

    const passportSecret = process.env.PASSPORT_SECRET || process.env.SECRET;
    if (passportSecret) args["passport-secret"] = passportSecret;

    const bucketDataHashSecret = process.env.BUCKET_DATA_HASH_SECRET;
    if (bucketDataHashSecret) args["bucket-data-hash-secret"] = bucketDataHashSecret;

    const bucketDataEncryptionSecret = process.env.BUCKET_DATA_ENCRYPTION_SECRET;
    if (bucketDataEncryptionSecret)
      args["bucket-data-encryption-secret"] = bucketDataEncryptionSecret;

    const secretModuleEncryptionSecret = process.env.SECRET_MODULE_ENCRYPTION_SECRET;
    if (secretModuleEncryptionSecret)
      args["secret-module-encryption-secret"] = secretModuleEncryptionSecret;

    const userVerificationHashSecret = process.env.USER_VERIFICATION_HASH_SECRET;
    if (userVerificationHashSecret)
      args["user-verification-hash-secret"] = userVerificationHashSecret;

    const userProviderEncryptionSecret = process.env.USER_PROVIDER_ENCRYPTION_SECRET;
    if (userProviderEncryptionSecret)
      args["user-provider-encryption-secret"] = userProviderEncryptionSecret;

    const userProviderHashSecret = process.env.USER_PROVIDER_HASH_SECRET;
    if (userProviderHashSecret) args["user-provider-hash-secret"] = userProviderHashSecret;

    const refreshTokenHashSecret = process.env.REFRESH_TOKEN_HASH_SECRET;
    if (refreshTokenHashSecret) args["refresh-token-hash-secret"] = refreshTokenHashSecret;

    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    if (twilioAccountSid) {
      args["twilio-sms-service-account-sid"] = twilioAccountSid;
    }

    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    if (twilioAuthToken) {
      args["twilio-sms-service-auth-token"] = twilioAuthToken;
    }

    const twilioFromNumber = process.env.TWILIO_FROM_NUMBER;
    if (twilioFromNumber) {
      args["twilio-sms-service-from-number"] = twilioFromNumber;
    }
  })
  .check(args => {
    if (!args["passport-identity-token-expiration-seconds-limit"]) {
      args["passport-identity-token-expiration-seconds-limit"] =
        args["passport-identity-token-expires-in"];
    }

    if (!args["passport-user-token-expiration-seconds-limit"]) {
      args["passport-user-token-expiration-seconds-limit"] = args["passport-user-token-expires-in"];
    }

    if (args["bucket-cache"] && args["bucket-cache-ttl"] < 1) {
      throw new TypeError("--bucket-cache-ttl must be a positive number");
    }

    if (!Number.isInteger(args["database-change-stream-await-time"]) || args["database-change-stream-await-time"] < 1) {
      throw new TypeError("--database-change-stream-await-time must be a positive integer");
    }

    if (
      args["passport-identity-token-expiration-seconds-limit"] <
      args["passport-identity-token-expires-in"]
    ) {
      throw new TypeError(
        `--passport-identity-token-expiration-seconds-limit(${args["passport-identity-token-expiration-seconds-limit"]} seconds) can not be less than --passport-identity-token-expires-in(${args["passport-identity-token-expires-in"]} seconds)`
      );
    }

    if (
      args["passport-user-token-expiration-seconds-limit"] < args["passport-user-token-expires-in"]
    ) {
      throw new TypeError(
        `--passport-user-token-expiration-seconds-limit(${args["passport-user-token-expiration-seconds-limit"]} seconds) can not be less than --passport-user-token-expires-in(${args["passport-user-token-expires-in"]} seconds)`
      );
    }

    if (!args["default-storage-public-url"]) {
      args["default-storage-public-url"] = args["public-url"];
    }

    if (!args["function-api-url"]) {
      args["function-api-url"] = `http://127.0.0.1:${args["port"]}`;
    }

    if (args["function-worker-concurrency"] < 1) {
      throw new TypeError("--function-worker-concurrency must be a positive number");
    }

    if (args["function-worker-event-concurrency"] < 1) {
      throw new TypeError("--function-worker-event-concurrency must be a positive number");
    }

    if (args["function-warm-workers-max"] < 0) {
      throw new TypeError("--function-warm-workers-max must not be a negative number");
    }

    const validLogOutputs = ["database", "stdout"];
    const workerLogOutput = args["function-worker-log-output"] as string[];
    for (const output of workerLogOutput) {
      if (!validLogOutputs.includes(output)) {
        throw new TypeError(
          `Invalid --function-worker-log-output value: '${output}'. Must be one of: ${validLogOutputs.join(", ")}`
        );
      }
    }
    if (workerLogOutput.length === 0) {
      throw new TypeError(
        "--function-worker-log-output must include at least one value: database, stdout"
      );
    }

    if (
      args["storage-strategy"] == "gcloud" &&
      (!args["gcloud-service-account-path"] || !args["gcloud-bucket-name"])
    ) {
      throw new TypeError(
        "--gcloud-service-account-path and --gcloud-bucket-name options must be present when --storage-strategy is set to 'gcloud'."
      );
    }

    if (args["storage-strategy"] == "awss3" && !args["awss3-bucket-name"]) {
      throw new TypeError(
        "--awss3-bucket-name option must be present when --storage-strategy is set to 'awss3'."
      );
    }

    if (
      args["function-asset-storage-strategy"] == "awss3" &&
      !args["function-asset-awss3-bucket-name"]
    ) {
      throw new TypeError(
        "--function-asset-awss3-bucket-name must be present when --function-asset-storage-strategy is set to 'awss3'."
      );
    }

    if (
      args["function-asset-storage-strategy"] == "gcs" &&
      (!args["function-asset-gcs-service-account-path"] || !args["function-asset-gcs-bucket-name"])
    ) {
      throw new TypeError(
        "--function-asset-gcs-service-account-path and --function-asset-gcs-bucket-name must be present when --function-asset-storage-strategy is set to 'gcs'."
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

    const masterKey = args["master-key"];
    const derivableSecretsKeys = [
      "passport-secret",
      "bucket-data-hash-secret",
      "bucket-data-encryption-secret",
      "secret-module-encryption-secret",
      "user-verification-hash-secret",
      "user-provider-encryption-secret",
      "user-provider-hash-secret",
      "refresh-token-hash-secret"
    ];

    if (!masterKey) {
      for (const key of derivableSecretsKeys) {
        if (!args[key]) {
          throw new TypeError(`${key} is required when the master-key is not provided`);
        }
      }
    } else {
      for (const key of derivableSecretsKeys) {
        if (!args[key]) {
          args[key] = deriveKey(masterKey, key);
        }
      }
    }

    return true;
  })
  .parserConfiguration({
    "duplicate-arguments-array": false
  })
  .env()
  .parse() as any;

const modules = [
  BatchModule.forRoot({
    port: args["port"]
  }),
  DashboardModule.forRoot({realtime: true}),
  PreferenceModule.forRoot(),
  AssetModule.forRoot({persistentPath: args["persistent-path"]}),
  DatabaseModule.withConnection(args["database-uri"], {
    database: args["database-name"],
    replicaSet: args["database-replica-set"],
    maxPoolSize: args["database-pool-size"],
    appName: "spica",
    readPreference: args["database-read-preference"],
    changeStreamAwaitTimeMS: args["database-change-stream-await-time"]
  }),
  EnvVarModule.forRoot({
    realtime: true
  }),
  SecretModule.forRoot({
    realtime: true,
    encryptionSecret: args["secret-module-encryption-secret"]
  }),
  MailerModule.forRoot({
    host: args["mailer-host"],
    port: args["mailer-port"],
    secure: args["mailer-secure"],
    auth: {
      user: args["mailer-user"],
      pass: args["mailer-pass"]
    },
    defaults: {
      from: args["mailer-from"]
    }
  }),
  SmsModule.forRoot({
    strategy: args["sms-sender-strategy"] as "twilio",
    twilio: {
      accountSid: args["twilio-sms-service-account-sid"],
      authToken: args["twilio-sms-service-auth-token"],
      fromNumber: args["twilio-sms-service-from-number"]
    }
  }),
  SchemaModule.forRoot({
    formats: [OBJECT_ID, DATE_TIME, OBJECTID_STRING],
    defaults: [CREATED_AT, UPDATED_AT]
  }),
  BucketModule.forRoot({
    hooks: args["bucket-hooks"],
    history: args["bucket-history"],
    realtime: true,
    cache: args["bucket-cache"],
    cacheTtl: args["bucket-cache-ttl"],
    bucketDataLimit: args["bucket-data-limit"],
    graphql: args["bucket-graphql"],
    hashSecret: args["bucket-data-hash-secret"],
    encryptionSecret: args["bucket-data-encryption-secret"]
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
    totalSizeLimit: args["storage-total-size-limit"],
    resumableUploadExpiresIn: args["resumable-upload-expires-in"]
  }),
  PassportModule.forRoot({
    publicUrl: args["public-url"],
    defaultStrategy: args["passport-default-strategy"],
    samlCertificateTTL: args["passport-saml-certificate-ttl"],
    apikeyRealtime: true,
    refreshTokenRealtime: true,
    policyRealtime: true,
    identityOptions: {
      expiresIn: args["passport-identity-token-expires-in"],
      maxExpiresIn: args["passport-identity-token-expiration-seconds-limit"],
      issuer: args["public-url"],
      refreshTokenExpiresIn: args["passport-identity-refresh-token-expires-in"],
      refreshTokenHashSecret: args["refresh-token-hash-secret"],
      secretOrKey: args["passport-secret"],
      audience: "spica.io",
      defaultIdentityIdentifier: args["passport-default-identity-identifier"],
      defaultIdentityPassword: args["passport-default-identity-password"],
      defaultIdentityPolicies: args["passport-default-identity-policies"],
      entryLimit: args["passport-identity-limit"],
      passwordHistoryLimit: args["passport-identity-password-history-limit"],
      blockingOptions: {
        failedAttemptLimit: args["passport-identity-failed-login-attempt-limit"],
        blockDurationMinutes: args["passport-identity-block-duration-after-failed-login-attempts"]
      },
      identityRealtime: true
    },
    userOptions: {
      expiresIn: args["passport-user-token-expires-in"],
      maxExpiresIn: args["passport-user-token-expiration-seconds-limit"],
      issuer: args["public-url"],
      refreshTokenExpiresIn: args["passport-user-refresh-token-expires-in"],
      refreshTokenHashSecret: args["refresh-token-hash-secret"],
      secretOrKey: args["passport-secret"],
      audience: "spica.io",
      entryLimit: args["passport-user-limit"],
      passwordHistoryLimit: args["passport-user-password-history-limit"],
      blockingOptions: {
        failedAttemptLimit: args["passport-user-failed-login-attempt-limit"],
        blockDurationMinutes: args["passport-user-block-duration-after-failed-login-attempts"]
      },
      userRealtime: true,
      verificationHashSecret: args["user-verification-hash-secret"],
      providerEncryptionSecret: args["user-provider-encryption-secret"],
      providerHashSecret: args["user-provider-hash-secret"],
      verificationCodeExpiresIn: args["passport-user-verification-code-expires-in"]
    }
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
    eventConcurrency: args["function-worker-event-concurrency"],
    maxWarmWorkers: args["function-warm-workers-max"],
    realtimeLogs: true,
    logger: args["function-logger"],
    invocationLogs: args["function-invocation-logs"],
    workerLogOutput: args["function-worker-log-output"],
    realtime: true,
    grpcPort: args["grpc-function-port"],
    functionGrpcMaxMessageSizeBytes: args["function-grpc-max-message-size-bytes"],
    assetStorage: {
      strategy: args["function-asset-storage-strategy"],
      defaultPath: args["function-asset-path"],
      awss3CredentialsPath: args["function-asset-awss3-credentials-path"],
      awss3BucketName: args["function-asset-awss3-bucket-name"],
      gcsServiceAccountPath: args["function-asset-gcs-service-account-path"],
      gcsBucketName: args["function-asset-gcs-bucket-name"]
    },
    payloadSizeLimit: args["payload-size-limit"]
  }),
  ConfigModule.forRoot(),
  StatusModule.forRoot({
    expireAfterSeconds: args["common-log-lifespan"],
    httpStatusTracking: args["http-status-tracking"]
  })
];

if (args["activity-stream"]) {
  modules.push(ActivityModule.forRoot({expireAfterSeconds: args["common-log-lifespan"]}));
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
  app.getHttpAdapter().getInstance().set("trust proxy", args["trust-proxy"]);
  console.log("PROXY at main.ts", app.getHttpAdapter().getInstance().get("trust proxy"));
  app.useWebSocketAdapter(new WsAdapter(app));
  app.use(
    Middlewares.Headers({
      "Cache-Control": args["cache-control-header"],
      "X-Frame-Options": args["x-frame-options-header"]
    }),
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

  app.use(cookieParser());

  const {port} = await args;
  await app.listen(port);
  new Logger("Bootstrap").log(`: APIs are ready on port ${port}`);
});
