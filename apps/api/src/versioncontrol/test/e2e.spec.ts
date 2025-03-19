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

  function getEmptyBucket() {
    return {
      title: "bucket1",
      description: "Description of bucket1",
      history: false,
      icon: "view_stream",
      properties: {
        title: {
          type: "string",
          options: {position: "bottom"}
        }
      },
      acl: {read: "true==true", write: "true==true"},
      primary: "title"
    };
  }

  function getEmptyFunction() {
    return {
      name: "fn1",
      env: {},
      language: "javascript",
      timeout: 100,
      triggers: {
        default: {
          type: "http",
          active: true,
          options: {method: "Get", path: "/test", preflight: true}
        }
      },
      memoryLimit: 100
    };
  }

  function insertBucket(bucket) {
    return req.post("/bucket", bucket).then(r => r.body);
  }

  function insertFunction(fn) {
    return req.post("/function", fn).then(r => r.body);
  }

  function insertFunctionIndex(id, index) {
    return req.post(`/function/${id}/index`, {index});
  }

  async function commit(message: string) {
    await req.post("/versioncontrol/commands/add", {args: ["."]});
    await req.post("/versioncontrol/commands/commit", {args: ["-m", `'${message}'`]});
  }

  function checkout(branch: string) {
    return req.post("/versioncontrol/commands/checkout", {args: [branch]});
  }

  function branch(branch: string) {
    return req.post("/versioncontrol/commands/branch", {args: [branch]});
  }

  function stringToArray(str: string) {
    return str.split("\n").filter(s => s != "");
  }

  let bucket;
  let fn;

  describe("commands", () => {
    it("should get available commands", async () => {
      const res = await req.get("/versioncontrol/commands");

      expect([res.statusCode, res.statusText]).toEqual([200, "OK"]);
      expect(res.body).toEqual([
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
      ]);
    });

    describe("add", () => {
      beforeEach(async () => {
        bucket = await insertBucket(getEmptyBucket());
        fn = await insertFunction(getEmptyFunction()).then(async fn => {
          await insertFunctionIndex(fn._id, "console.log()");
          return fn;
        });
      });

      it("should add all files", async () => {
        await req.post("/versioncontrol/commands/add", {args: ["."]});

        const res = await req.post("/versioncontrol/commands/diff", {
          args: ["--name-only", "--staged"]
        });

        const changes = res.body.message.split("\n").filter(c => c != "");
        expect(changes).toEqual([
          //bucket
          `bucket/${bucket._id}/schema.yaml`,
          //fn
          `function/${fn._id}/env.env`,
          `function/${fn._id}/index.ts`,
          `function/${fn._id}/package.json`,
          `function/${fn._id}/schema.yaml`
        ]);
      });

      it("should add only functions", async () => {
        await req.post("/versioncontrol/commands/add", {args: ["function/*"]});

        const res = await req.post("/versioncontrol/commands/diff", {
          args: ["--name-only", "--staged"]
        });

        const changes = stringToArray(res.body.message);
        expect(changes).toEqual([
          `function/${fn._id}/env.env`,
          `function/${fn._id}/index.ts`,
          `function/${fn._id}/package.json`,
          `function/${fn._id}/schema.yaml`
        ]);
      });
    });

    describe("branch", () => {
      it("should create a new branch", async () => {
        await insertBucket(getEmptyBucket());
        await commit("first commit");

        await req.post("/versioncontrol/commands/branch", {args: ["feature"]});

        const res = await req.post("/versioncontrol/commands/branch", {args: []});

        expect(res.body.all).toEqual(["feature", "master"]);
        expect(res.body.current).toEqual("master");
      });
    });

    describe("checkout", () => {
      it("should switch to existing branch", async () => {
        await insertBucket(getEmptyBucket());
        await commit("first commit");

        await req.post("/versioncontrol/commands/branch", {args: ["build"]});

        await req.post("/versioncontrol/commands/checkout", {args: ["build"]});

        const res = await req.post("/versioncontrol/commands/branch", {args: []});

        expect(res.body.all).toEqual(["build", "master"]);
        expect(res.body.current).toEqual("build");
      });

      it("should create and switch to new branch", async () => {
        await insertBucket(getEmptyBucket());
        await commit("first commit");

        await req.post("/versioncontrol/commands/checkout", {args: ["-b", "deployment"]});

        const res = await req.post("/versioncontrol/commands/branch", {args: []});

        expect(res.body.all).toEqual(["deployment", "master"]);
        expect(res.body.current).toEqual("deployment");
      });
    });

    describe("commit", () => {
      it("should commit", async () => {
        await insertBucket(getEmptyBucket());

        await req.post("/versioncontrol/commands/add", {args: ["."]});
        await req.post("/versioncontrol/commands/commit", {args: ["-m", "'first commit'"]});

        const res = await req.post("/versioncontrol/commands/log", {args: []});
        expect(res.body.latest.message).toEqual("'first commit'");
      });
    });

    describe("reset", () => {
      it("should reset to previous commit", async () => {
        await insertBucket(getEmptyBucket());
        await commit("first commit");

        const bucket2 = await insertBucket(getEmptyBucket());
        await commit("second commit");

        // to ensure that two buckets exist
        let buckets = await req.get("/bucket").then(r => r.body);
        expect(buckets.length).toEqual(2);

        await req.post("/versioncontrol/commands/reset", {args: ["--hard", "HEAD~1"]});

        buckets = await req.get("/bucket").then(r => r.body);
        expect(buckets.length).toEqual(1);
        expect(buckets[0]._id).not.toEqual(bucket2._id);
      });
    });

    describe("tag", () => {
      it("should tag", async () => {
        await insertBucket(getEmptyBucket());
        await commit("first commit");

        await req.post("/versioncontrol/commands/tag", {args: ["0.1"]});

        const res = await req.post("/versioncontrol/commands/tag", {args: []});
        const tags = stringToArray(res.body.message);
        expect(tags).toEqual(["0.1"]);
      });
    });

    describe("stash", () => {
      it("should stash changes", async () => {
        await insertBucket(getEmptyBucket());
        await commit("first commit");

        const bucket2 = await insertBucket(getEmptyBucket());
        await req.post("/versioncontrol/commands/stash", {
          args: ["push", "-m", "wip", "--include-untracked"]
        });

        let res = await req.post("/versioncontrol/commands/stash", {args: ["list"]});
        const stashes = stringToArray(res.body.message);
        expect(stashes).toEqual(["stash@{0}: On master: wip"]);

        let buckets = await req.get("/bucket").then(r => r.body);
        expect(buckets.length).toEqual(1);
        expect(buckets[0]._id).not.toEqual(bucket2._id);

        await req.post("/versioncontrol/commands/stash", {args: ["apply", "0"]});
        buckets = await req.get("/bucket").then(r => r.body);
        expect(buckets.length).toEqual(2);
        expect(buckets[1]._id).toEqual(bucket2._id);
      });
    });

    describe("merge", () => {
      it("should merge branches", async () => {
        await insertBucket(getEmptyBucket());
        await commit("first commit");

        await branch("fix");
        await checkout("fix");

        await insertBucket(getEmptyBucket());
        await commit("bucket 2 inserted");

        await checkout("master");
        await req.post("/versioncontrol/commands/merge", {args: ["fix"]});

        const res = await req.post("/versioncontrol/commands/log", {args: []});
        expect(res.body.all.map(c => c.message)).toEqual(["'bucket 2 inserted'", "'first commit'"]);
      });
    });

    describe("rebase", () => {
      it("should rebase branches", async () => {
        await insertBucket(getEmptyBucket());
        await commit("first commit");

        await branch("fix");
        await checkout("fix");

        await insertBucket(getEmptyBucket());
        await commit("bucket 2 inserted");

        await branch("master");
        await checkout("master");

        await insertBucket(getEmptyBucket());
        await commit("bucket 3 inserted");

        await req.post("/versioncontrol/commands/rebase", {args: ["fix"]});

        const res = await req.post("/versioncontrol/commands/log", {args: []});
        expect(res.body.all.map(c => c.message)).toEqual([
          "'bucket 3 inserted'",
          "'bucket 2 inserted'",
          "'first commit'"
        ]);
      });
    });
  });
});
