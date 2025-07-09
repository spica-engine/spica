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
import {VCRepresentativeManager} from "@spica-server/representative";
import {VersionControlModule} from "@spica-server/versioncontrol";
import {VC_REPRESENTATIVE_MANAGER} from "@spica-server/interface/versioncontrol";
import os from "os";
import fs from "fs";
import {execSync} from "child_process";
import path from "path";
import {v4 as uuidv4} from "uuid";

process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:50050";

const sleep = () => new Promise(r => setTimeout(r, 1000));

describe("Versioning e2e", () => {
  let module: TestingModule;
  let app: INestApplication;
  let req: Request;
  let rep: VCRepresentativeManager;
  let directoryPath: string;

  beforeEach(async () => {
    directoryPath = path.join(os.tmpdir(), uuidv4());
    fs.mkdirSync(directoryPath, {recursive: true});

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
          path: directoryPath,
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
        VersionControlModule.forRoot({persistentPath: directoryPath, isReplicationEnabled: false})
      ]
    }).compile();
    module.enableShutdownHooks();

    app = module.createNestApplication();
    req = module.get(Request);
    rep = module.get(VC_REPRESENTATIVE_MANAGER);

    app.useWebSocketAdapter(new WsAdapter(app));

    await app.listen(req.socket);
  });

  afterEach(async () => {
    // we should not remove representatives directory for real cases because after some crash, we might want to start from old representatives
    // but it should be removed for tests cases in order to make tests run clearly
    await rep.rm();
    await app.close();
    const functionsDir = path.join(directoryPath, "functions");
    fs.rmSync(functionsDir, {recursive: true, force: true});
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
        "rm",
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
        await sleep();
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
          `function/${fn.name}(${fn._id})/index.js`,
          `function/${fn.name}(${fn._id})/package.json`,
          `function/${fn.name}(${fn._id})/schema.yaml`
        ]);
      });

      it("should add only functions", async () => {
        await req.post("/versioncontrol/commands/add", {args: ["function/*"]});

        const res = await req.post("/versioncontrol/commands/diff", {
          args: ["--name-only", "--staged"]
        });

        const changes = stringToArray(res.body.message);
        expect(changes).toEqual([
          `function/${fn.name}(${fn._id})/index.js`,
          `function/${fn.name}(${fn._id})/package.json`,
          `function/${fn.name}(${fn._id})/schema.yaml`
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
        await req.post("/versioncontrol/commands/commit", {
          args: ["-m", "'first commit'"]
        });

        const res = await req.post("/versioncontrol/commands/log", {args: []});
        expect(res.body.latest.message).toEqual("first commit");
      });
    });

    describe("reset", () => {
      it("should reset to previous commit", async () => {
        await insertBucket(getEmptyBucket());
        await sleep();
        await commit("first commit");

        const bucket2 = await insertBucket(getEmptyBucket());
        await sleep();
        await commit("second commit");

        // to ensure that two buckets exist
        let buckets = await req.get("/bucket").then(r => r.body);
        expect(buckets.length).toEqual(2);

        await req.post("/versioncontrol/commands/reset", {args: ["--hard", "HEAD~1"]});
        await sleep();

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
        await sleep();
        await commit("first commit");

        const bucket2 = await insertBucket(getEmptyBucket());
        await sleep();
        await req.post("/versioncontrol/commands/stash", {
          args: ["push", "-m", "wip", "--include-untracked"]
        });

        let res = await req.post("/versioncontrol/commands/stash", {args: ["list"]});
        await sleep();
        const stashes = stringToArray(res.body.message);
        expect(stashes).toEqual(["stash@{0}: On master: wip"]);

        let buckets = await req.get("/bucket").then(r => r.body);
        expect(buckets.length).toEqual(1);
        expect(buckets[0]._id).not.toEqual(bucket2._id);

        await req.post("/versioncontrol/commands/stash", {args: ["apply", "0"]});
        await sleep();
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
        expect(res.body.all.map(c => c.message)).toEqual(["bucket 2 inserted", "first commit"]);
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
          "bucket 3 inserted",
          "bucket 2 inserted",
          "first commit"
        ]);
      });
    });

    describe("remote repo", () => {
      let bareRepo: string;

      beforeEach(async () => {
        bareRepo = path.join(directoryPath, "test-repo");
        fs.mkdirSync(bareRepo, {recursive: true});
        execSync("git init --bare", {cwd: bareRepo});
      });

      afterEach(() => {
        fs.rmSync(bareRepo, {recursive: true, force: true});
      });

      it("should show remote", async () => {
        await req.post("/versioncontrol/commands/remote", {args: ["add", "origin", bareRepo]});
        const res = await req.post("/versioncontrol/commands/remote");
        expect(res.body.message).toEqual("origin\n");
      });

      it("should clean", async () => {
        const res = await req.post("/versioncontrol/commands/clean", {args: ["-f", "-d"]});
        expect(res.body.folders).toEqual(["bucket/", "function/"]);
      });

      it("should push", async () => {
        await insertBucket(getEmptyBucket());
        await commit("initial commit");

        await req.post("/versioncontrol/commands/remote", {args: ["add", "origin", bareRepo]});
        await req.post("/versioncontrol/commands/push", {args: ["origin", "master"]});

        const res = await req.post("/versioncontrol/commands/log", {args: ["origin/master"]});
        expect(res.body.all.map(c => c.message)).toEqual(["initial commit"]);
      });

      it("should fetch", async () => {
        await insertBucket(getEmptyBucket());
        await commit("initial commit");

        await req.post("/versioncontrol/commands/remote", {args: ["add", "origin", bareRepo]});
        await req.post("/versioncontrol/commands/push", {args: ["origin", "master"]});

        await req.post("/versioncontrol/commands/branch", {args: ["-dr", "origin/master"]});

        const res = await req.post("/versioncontrol/commands/branch");
        expect(Object.keys(res.body.branches)).toEqual(["master"]);

        await req.post("/versioncontrol/commands/fetch", {args: ["origin"]});

        const updatedRes = await req.post("/versioncontrol/commands/branch");
        expect(Object.keys(updatedRes.body.branches)).toEqual(["master", "remotes/origin/master"]);
      });

      it("should pull", async () => {
        await insertBucket(getEmptyBucket());
        await commit("initial commit");
        await insertBucket(getEmptyBucket());
        await commit("second commit");

        await req.post("/versioncontrol/commands/remote", {args: ["add", "origin", bareRepo]});
        await req.post("/versioncontrol/commands/push", {args: ["-u", "origin", "master"]});

        await req.post("/versioncontrol/commands/reset", {args: ["--hard", "HEAD~1"]});

        const log = await req.post("/versioncontrol/commands/log", {args: ["master"]});
        expect(log.body.all.map(c => c.message)).toEqual(["initial commit"]);

        await req.post("/versioncontrol/commands/pull");

        const updatedLog = await req.post("/versioncontrol/commands/log", {args: ["master"]});
        expect(updatedLog.body.all.map(c => c.message)).toEqual([
          "second commit",
          "initial commit"
        ]);
      });
    });
  });
});
