import {INestApplication} from "@nestjs/common";
import {TestingModule, Test} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket";
import {SchemaModule} from "@spica-server/core/schema";
import {OBJECTID_STRING, DATE_TIME, OBJECT_ID} from "@spica-server/core/schema/formats";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {WsAdapter} from "@spica-server/core/websocket";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {FunctionModule} from "@spica-server/function";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {RepresentativeManager} from "@spica-server/representative";
import {VC_REP_MANAGER, VersionControlModule} from "@spica-server/versioncontrol";

import os from "os";

process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:50050";

describe("Versioning e2e", () => {
  let module: TestingModule;
  let app: INestApplication;
  let req: Request;
  let rep: RepresentativeManager;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        CoreTestingModule,
        DatabaseTestingModule.replicaSet(),
        PreferenceTestingModule,
        PassportTestingModule.initialize(),
        SchemaModule.forRoot({formats: [OBJECT_ID, OBJECTID_STRING, DATE_TIME]}),
        BucketModule.forRoot({
          hooks: false,
          history: false,
          realtime: false,
          cache: false,
          graphql: false
        }),
        FunctionModule.forRoot({
          invocationLogs: false,
          path: os.tmpdir(),
          databaseName: undefined,
          databaseReplicaSet: undefined,
          databaseUri: undefined,
          apiUrl: undefined,
          timeout: 20,
          corsOptions: {
            allowCredentials: true,
            allowedHeaders: ["*"],
            allowedMethods: ["*"],
            allowedOrigins: ["*"]
          },
          logExpireAfterSeconds: 60,
          entryLimit: 20,
          maxConcurrency: 1,
          debug: false,
          realtimeLogs: false,
          logger: false,
          spawnEntrypointPath: process.env.FUNCTION_SPAWN_ENTRYPOINT_PATH,
          tsCompilerPath: process.env.FUNCTION_TS_COMPILER_PATH
        }),
        VersionControlModule.forRoot({persistentPath: os.tmpdir(), isReplicationEnabled: false})
      ]
    }).compile();
    module.enableShutdownHooks();

    app = module.createNestApplication();
    req = module.get(Request);
    rep = module.get(VC_REP_MANAGER);

    app.useWebSocketAdapter(new WsAdapter(app));

    await app.listen(req.socket);
  });

  afterEach(async () => {
    // we should not remove representatives directory for real cases because after some crash, we might want to start from old representatives
    // but it should be removed for tests cases in order to make tests run clearly
    await rep.rm();
    await app.close();
  });

  describe("commands", () => {
    it("should get available commands", async () => {
      const res = await req.get("/versioncontrol/commands");
      expect([res.statusCode, res.statusText, res.body]).toEqual([
        200,
        "OK",
        [
          "add",
          "branch",
          "checkout",
          "clean",
          "commit",
          "diff",
          "fetch",
          "log",
          "merge",
          "pull",
          "push",
          "rebase",
          "remote",
          "reset",
          "stash",
          "tag"
        ]
      ]);
    });
  });
});
