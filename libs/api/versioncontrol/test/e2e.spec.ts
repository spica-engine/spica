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
import {SecretModule} from "@spica-server/secret/src/module";
import {ConfigModule} from "@spica-server/config";

process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:50050";

const sleep = (ms: number = 1000) => new Promise(r => setTimeout(r, ms));

describe("Versioning e2e", () => {
  let module: TestingModule;
  let app: INestApplication;
  let req: Request;
  let rep: VCRepresentativeManager;
  let directoryPath: string;
  let representativesDir: string;

  // Set up the entire NestJS app ONCE per suite.
  // Starting a MongoDB replica set via Docker is expensive (~30 s+); doing it
  // for every test would blow past the per-test timeout. The 120 s budget here
  // is intentionally generous to accommodate slow CI environments.
  beforeAll(async () => {
    directoryPath = path.join(os.tmpdir(), uuidv4());
    fs.mkdirSync(directoryPath, {recursive: true});
    representativesDir = path.join(directoryPath, "representatives");

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
        SecretModule.forRoot({
          realtime: false,
          encryptionSecret: "test-encryption-secret-32chars!!"
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
          tsCompilerPath: process.env.FUNCTION_TS_COMPILER_PATH,
          realtime: false
        }),
        VersionControlModule.forRoot({persistentPath: directoryPath, isReplicationEnabled: false}),
        ConfigModule.forRoot()
      ]
    }).compile();
    module.enableShutdownHooks();

    app = module.createNestApplication();
    req = module.get(Request);
    rep = module.get(VC_REPRESENTATIVE_MANAGER);

    app.useWebSocketAdapter(new WsAdapter(app));
    await app.listen(req.socket);

    // Configure autoApproveSync once – the setting persists for the entire suite.
    await req.put("config/versioncontrol", {
      autoApproveSync: {
        document: true,
        representative: true
      }
    });
    // Allow the sync engine to read the new config and finish git initialisation.
    await sleep(5000);
  }, 120_000);

  afterAll(async () => {
    await rep.rm();
    await app.close();
    fs.rmSync(directoryPath, {recursive: true, force: true});
  });

  /**
   * Poll until git's working-tree (untracked files + tracked-but-modified)
   * shows at least one pending change.  This is strictly more accurate than
   * checking the file system for any file, because the previous approach
   * returned immediately when it found committed representative files from an
   * earlier commit in the same test, causing the next `git add` to stage
   * nothing and the commit to silently succeed with an empty tree.
   */
  async function waitForGitChanges(timeoutMs = 5000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const status = execSync("git status --porcelain", {
          cwd: representativesDir,
          stdio: "pipe"
        })
          .toString()
          .trim();
        if (status.length > 0) return;
      } catch {
        // git may fail if the repo has no commits yet – treat as no changes
      }
      await sleep(200);
    }
  }

  /**
   * Poll until the compiled function files (index.js) appear inside the
   * representatives directory.  Compilation is async and may take several
   * seconds, so a fixed sleep is unreliable.
   */
  async function waitForFnFiles(timeoutMs = 15000): Promise<void> {
    const fnRepDir = path.join(representativesDir, "function");
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (fs.existsSync(fnRepDir)) {
        const subdirs = fs.readdirSync(fnRepDir);
        for (const subdir of subdirs) {
          if (fs.existsSync(path.join(fnRepDir, subdir, "index.js"))) return;
        }
      }
      await sleep(300);
    }
  }

  /**
   * Between every test we need a truly clean slate:
   * 1. Delete all database resources (buckets, functions) so the sync engine
   *    has nothing to write to the representatives directory.
   * 2. Brief pause so the sync engine can flush any pending delete events.
   * 3. Reset the git repo WITHOUT deleting the watched module directories.
   *    chokidar watches bucket/ and function/; removing those directories
   *    destroys the filesystem watchers and breaks subsequent tests.  Instead
   *    we delete only .git, clean any leftover content inside the module dirs,
   *    and re-initialise git in place.
   *
   * Note: simpleGit holds only a path reference; deleting/recreating .git is
   * fully transparent to subsequent git invocations.
   */
  beforeEach(async () => {
    // Remove all buckets.
    const buckets = await req
      .get("/bucket")
      .then(r => r.body)
      .catch(() => []);
    await Promise.all(buckets.map((b: {_id: string}) => req.delete(`/bucket/${b._id}`)));

    // Remove all functions.
    const fns = await req
      .get("/function")
      .then(r => r.body)
      .catch(() => []);
    await Promise.all(fns.map((f: {_id: string}) => req.delete(`/function/${f._id}`)));

    // Let the sync engine flush pending file-system events (writes/deletes of
    // representative files in bucket/ and function/).
    await sleep(1500);

    // Only delete .git – the watched module directories must remain so that
    // the chokidar watchers registered during app startup stay alive.
    const gitDir = path.join(representativesDir, ".git");
    if (fs.existsSync(gitDir)) {
      fs.rmSync(gitDir, {recursive: true, force: true});
    }

    // Clean any leftover representative files inside module dirs but keep the
    // dirs themselves (chokidar watches them).
    for (const moduleDir of ["bucket", "function"]) {
      const fullModuleDir = path.join(representativesDir, moduleDir);
      if (fs.existsSync(fullModuleDir)) {
        for (const entry of fs.readdirSync(fullModuleDir)) {
          fs.rmSync(path.join(fullModuleDir, entry), {recursive: true, force: true});
        }
      }
    }

    // Re-initialise git so every test starts with a fresh, empty commit history.
    // Force 'master' as the default branch name so existing test assertions that
    // reference 'master' (stash branch name, push target, etc.) stay valid.
    execSync(
      'git init -b master && git config user.name "Spica" && git config user.email "Spica"',
      {cwd: representativesDir, stdio: "pipe"}
    );

    // Ensure watched module directories exist.  Some tests (e.g. "should clean")
    // run `git clean -fd` which actually removes these directories from disk.
    // chokidar backed by macOS FSEvents detects the recreation; we give it a
    // brief moment below to pick up the new inodes before the test body runs.
    for (const moduleDir of ["bucket", "function"]) {
      const fullModuleDir = path.join(representativesDir, moduleDir);
      if (!fs.existsSync(fullModuleDir)) {
        fs.mkdirSync(fullModuleDir, {recursive: true});
      }
    }

    // Brief pause so the filesystem watcher can register the recreated
    // directories before the test body starts writing into them.
    await sleep(500);
  }, 30_000);

  function getEmptyBucket(title = "bucket1") {
    return {
      title: title,
      description: "Description of bucket1",
      history: false,
      icon: "view_stream",
      properties: {
        title: {
          type: "string"
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

  function insertBucket(bucket: object) {
    return req.post("/bucket", bucket).then(r => r.body);
  }

  function insertFunction(fn: object) {
    return req.post("/function", fn).then(r => r.body);
  }

  function insertFunctionIndex(id: string, index: string) {
    return req.post(`/function/${id}/index`, {index});
  }

  async function commit(message: string) {
    // Wait for the sync engine to have written any NEW representative file
    // (detected via uncommitted working-tree changes) before staging.
    await waitForGitChanges();
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
      let bucket: {_id: string; title: string};
      let fn: {_id: string; name: string};

      beforeEach(async () => {
        bucket = await insertBucket(getEmptyBucket());
        fn = await insertFunction(getEmptyFunction()).then(async fn => {
          await insertFunctionIndex(fn._id, "console.log()");
          return fn;
        });
        // Wait for ALL function representative files (including compiled
        // index.js) to appear before staging.  schema.yaml is fast; index.js
        // and package.json are written only after the build worker finishes.
        await waitForFnFiles();
      }, 30_000);

      it("should add all files", async () => {
        await req.post("/versioncontrol/commands/add", {args: ["."]});

        const res = await req.post("/versioncontrol/commands/diff", {
          args: ["--name-only", "--staged"]
        });

        const changes = res.body.message.split("\n").filter((c: string) => c != "");
        expect(changes).toEqual([
          //bucket
          `bucket/${bucket.title}/schema.yaml`,
          //fn
          `function/${fn.name}/index.mjs`,
          `function/${fn.name}/package.json`,
          `function/${fn.name}/schema.yaml`
        ]);
      });

      it("should add only functions", async () => {
        await req.post("/versioncontrol/commands/add", {args: ["function/*"]});

        const res = await req.post("/versioncontrol/commands/diff", {
          args: ["--name-only", "--staged"]
        });

        const changes = stringToArray(res.body.message);
        expect(changes).toEqual([
          `function/${fn.name}/index.mjs`,
          `function/${fn.name}/package.json`,
          `function/${fn.name}/schema.yaml`
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
        // Let the sync engine write schema.yaml before staging.
        await waitForGitChanges();

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
        await insertBucket(getEmptyBucket("bucket1"));
        await sleep();
        await commit("first commit");

        const bucket2 = await insertBucket(getEmptyBucket("bucket2"));
        // Wait for the sync engine to write and stabilise bucket2/schema.yaml
        // before committing.  The rep applier writes the file after the
        // bufferTime(2000) window expires (~2 s after insert); chokidar then
        // needs another 2 s stabilityThreshold before firing the 'add' event.
        // We wait 5 s to cover both windows with CI variance.
        await sleep(5000);
        await commit("second commit");

        // to ensure that two buckets exist
        let buckets = await req.get("/bucket").then(r => r.body);
        expect(buckets.length).toEqual(2);

        await req.post("/versioncontrol/commands/reset", {args: ["--hard", "HEAD~1"]});
        // Poll until the sync applier has processed the file deletion and
        // removed bucket2 from the DB (up to 10 s).
        for (let attempt = 0; attempt < 34; attempt++) {
          buckets = await req.get("/bucket").then(r => r.body);
          if (buckets.length === 1) break;
          await sleep(300);
        }

        expect(buckets.length).toEqual(1);
        expect(buckets[0]._id).not.toEqual(bucket2._id);
      }, 60_000);
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
        await insertBucket(getEmptyBucket("bucket1"));
        await sleep();
        await commit("first commit");

        const bucket2 = await insertBucket(getEmptyBucket("bucket2"));
        // Wait for the sync engine to write and stabilise bucket2/schema.yaml
        // before stashing.  See the reset test for the full timing explanation.
        await sleep(5000);
        await req.post("/versioncontrol/commands/stash", {
          args: ["push", "-m", "wip", "--include-untracked"]
        });

        // stash push is synchronous – the stash entry is in the stash log
        // before the server responds.  No additional sleep needed here.
        const res = await req.post("/versioncontrol/commands/stash", {args: ["list"]});
        const stashes = stringToArray(res.body.message);
        expect(stashes).toEqual(["stash@{0}: On master: wip"]);

        // Poll until the sync applier has detected the stashed file removal and
        // deleted bucket2 from the DB (up to 10 s).
        let buckets;
        for (let attempt = 0; attempt < 34; attempt++) {
          buckets = await req.get("/bucket").then(r => r.body);
          if (buckets.length === 1) break;
          await sleep(300);
        }
        expect(buckets.length).toEqual(1);
        expect(buckets[0]._id).not.toEqual(bucket2._id);

        await req.post("/versioncontrol/commands/stash", {args: ["apply", "0"]});
        // Poll until bucket2 is restored after the stash apply (up to 10 s).
        for (let attempt = 0; attempt < 34; attempt++) {
          buckets = await req.get("/bucket").then(r => r.body);
          if (buckets.length === 2) break;
          await sleep(300);
        }
        expect(buckets.length).toEqual(2);
        expect(buckets[1]._id).toEqual(bucket2._id);
      }, 60_000);
    });

    describe("merge", () => {
      it("should merge branches", async () => {
        await insertBucket(getEmptyBucket("bucket1"));
        await commit("first commit");

        await branch("fix");
        await checkout("fix");

        await insertBucket(getEmptyBucket("bucket2"));
        await commit("bucket 2 inserted");

        await checkout("master");
        await req.post("/versioncontrol/commands/merge", {args: ["fix"]});

        const res = await req.post("/versioncontrol/commands/log", {args: []});
        expect(res.body.all.map((c: {message: string}) => c.message)).toEqual([
          "bucket 2 inserted",
          "first commit"
        ]);
      });
    });

    describe("rebase", () => {
      it("should rebase branches", async () => {
        await insertBucket(getEmptyBucket("bucket 1"));
        await commit("first commit");

        await branch("fix");
        await checkout("fix");

        await insertBucket(getEmptyBucket("bucket 2"));
        await commit("bucket 2 inserted");

        // 'master' already exists (created by git init -b master); just switch
        // back to it instead of trying to create it again.
        await checkout("master");

        await insertBucket(getEmptyBucket("bucket 3"));
        await commit("bucket 3 inserted");

        await req.post("/versioncontrol/commands/rebase", {args: ["fix"]});

        const res = await req.post("/versioncontrol/commands/log", {args: []});
        expect(res.body.all.map((c: {message: string}) => c.message)).toEqual([
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
        // Force 'master' as the default branch in the bare repo  to match the
        // local repo's default branch set in the outer beforeEach.
        execSync("git init --bare -b master", {cwd: bareRepo});
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
        expect(res.body.all.map((c: {message: string}) => c.message)).toEqual(["initial commit"]);
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
        await insertBucket(getEmptyBucket("bucket1"));
        await commit("initial commit");
        await insertBucket(getEmptyBucket("bucket2"));
        await commit("second commit");

        await req.post("/versioncontrol/commands/remote", {args: ["add", "origin", bareRepo]});
        await req.post("/versioncontrol/commands/push", {args: ["-u", "origin", "master"]});

        await req.post("/versioncontrol/commands/reset", {args: ["--hard", "HEAD~1"]});

        const log = await req.post("/versioncontrol/commands/log", {args: ["master"]});
        expect(log.body.all.map((c: {message: string}) => c.message)).toEqual(["initial commit"]);

        await req.post("/versioncontrol/commands/pull");

        const updatedLog = await req.post("/versioncontrol/commands/log", {args: ["master"]});
        expect(updatedLog.body.all.map((c: {message: string}) => c.message)).toEqual([
          "second commit",
          "initial commit"
        ]);
      });
    });
  });
});
