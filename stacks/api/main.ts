import {Module} from "@nestjs/common";
import {NestFactory} from "@nestjs/core";
import {ActivityModule} from "@spica-server/activity";
import {BucketModule} from "@spica-server/bucket";
import {Middlewares} from "@spica-server/core";
import {SchemaModule} from "@spica-server/core/schema";
import {
  CREATED_AT,
  DATE_TIME,
  OBJECTID_STRING,
  OBJECT_ID,
  UPDATED_AT
} from "@spica-server/core/schema/defaults";
import {WsAdapter} from "@spica-server/core/websocket";
import {DashboardModule} from "@spica-server/dashboard";
import {DatabaseModule} from "@spica-server/database";
import {FunctionModule} from "@spica-server/function";
import {PassportModule} from "@spica-server/passport";
import {PreferenceModule} from "@spica-server/preference";
import {StorageModule} from "@spica-server/storage";
import * as fs from "fs";
import * as https from "https";
import * as yargs from "yargs";

const args = yargs
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
      description: "Whether Experimental Bucket Realtime feature is enabled.",
      default: true
    }
  })
  /* Passport Options  */
  .options({
    "passport-secret": {
      string: true,
      alias: ["secret"],
      description: "PEM-encoded public key (asymmetric) for verifying the JWT token's signature."
    },
    "passport-password": {
      string: true,
      description: "Password of the default 'spica' account.",
      default: "spica"
    }
  })
  .demandOption("passport-secret")
  /* Function Options */
  .options({
    "function-pool-size": {
      number: true,
      description: "Number of worker processes to fork at start up.",
      default: 10
    },
    "function-timeout": {
      number: true,
      description: "Amount of time in milliseconds that has to elapse before aborting a function.",
      default: 60000
    }
  })
  /* Storage Options */
  .option({
    "storage-strategy": {
      string: true,
      description: "Strategy types such as google cloud storage, cloudfare..",
      default: "gcloud"
    }
  })
  /* Common Options */
  .option("port", {
    number: true,
    alias: ["p"],
    default: 80,
    description: "A port to listen on."
  })
  .option("persistent-path", {
    string: true,
    default: "/var/data",
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
  .env()
  .parse();

const modules = [
  DashboardModule,
  PreferenceModule,
  DatabaseModule.withConnection(args["database-uri"], {
    database: args["database-name"],
    replicaSet: args["database-replica-set"],
    poolSize: args["database-pool-size"]
  }),
  SchemaModule.forRoot({
    formats: [OBJECT_ID, DATE_TIME, OBJECTID_STRING],
    defaults: [CREATED_AT, UPDATED_AT]
  }),
  BucketModule.forRoot({
    hooks: args["bucket-hooks"],
    history: args["bucket-history"],
    realtime: args["experimental-bucket-realtime"]
  }),
  StorageModule.forRoot({
    path: args["persistent-path"],
    publicUrl: args["public-url"],
    strategy: args["storage-strategy"]
  }),
  PassportModule.forRoot({
    publicUrl: args["public-url"],
    secretOrKey: args["passport-secret"],
    issuer: args["public-url"],
    defaultPassword: args["passport-password"],
    audience: "spica.io"
  }),
  FunctionModule.forRoot({
    path: args["persistent-path"],
    databaseName: args["database-name"],
    databaseReplicaSet: args["database-replica-set"],
    databaseUri: args["database-uri"],
    poolSize: args["function-pool-size"],
    publicUrl: args["public-url"],
    timeout: args["function-timeout"]
  })
];

if (args["activity-stream"]) {
  modules.push(ActivityModule.forRoot());
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
  httpsOptions
}).then(app => {
  app.useWebSocketAdapter(new WsAdapter(app));
  app.use(Middlewares.BsonBodyParser, Middlewares.MergePatchJsonParser, Middlewares.Preflight);
  app.listen(args.port);
});
