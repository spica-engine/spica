import {Global, INestApplication, Module} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {Middlewares} from "@spica-server/core";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {idOf} from "@spica-server/data";
import {contractSuite, waitForMongoIndexes} from "@spica-server/database-testing";
import {POLICY_RESOLVER, Statement} from "@spica-server/interface-passport-guard";
import {PassportTestingModule} from "@spica-server/passport-testing";
import {StorageModule} from "@spica-server/storage";
import fs from "fs";
import os from "os";
import path from "path";

let policies: {name: string; statement: Statement[]}[] = [];

@Global()
@Module({
  providers: [{provide: POLICY_RESOLVER, useValue: async () => policies}],
  exports: [POLICY_RESOLVER]
})
class PolicyTestingModule {}

const ACTIONS = ["storage:show", "storage:update", "storage:delete"];

const statements = (include: string[], exclude: string[]): Statement[] =>
  ACTIONS.map(action => ({action, module: "storage", resource: {include, exclude}}) as Statement);

const grant = (...lists: Statement[][]) => {
  policies = lists.map((statement, index) => ({name: `policy-${index}`, statement}));
};

contractSuite("Storage policies by id and by name", engine => {
  let app: INestApplication;
  let req: Request;
  let secretId: string;
  let openId: string;
  const storagePath = fs.mkdtempSync(path.join(os.tmpdir(), "spica-storage-policy-"));

  afterAll(() => fs.rmSync(storagePath, {recursive: true, force: true}));

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        CoreTestingModule,
        PolicyTestingModule,
        PassportTestingModule.initialize({skipActionCheck: false}),
        engine.module(),
        StorageModule.forRoot({
          defaultPath: storagePath,
          defaultPublicUrl: "http://insteadof",
          strategy: "default",
          objectSizeLimit: 0.1,
          totalSizeLimit: 5,
          resumableUploadExpiresIn: 1000 * 60
        })
      ]
    }).compile();
    app = module.createNestApplication({bodyParser: false});
    app.use(Middlewares.MergePatchJsonParser(10));
    req = module.get(Request);
    await app.listen(req.socket);
    await waitForMongoIndexes(engine, module, {storage: ["name_1"]});

    policies = [{name: "setup", statement: [{action: "storage:create", module: "storage"} as any]}];
    const {body} = await req.post("/storage", [
      object("secret.txt", "secret"),
      object("open.txt", "open")
    ]);
    [secretId, openId] = body.map(o => String(idOf(o)));
    grant(statements(["*"], []));
  });

  afterEach(async () => {
    grant(statements(["*"], []));
    await req.delete(`/storage/${secretId}`);
    await req.delete(`/storage/${openId}`);
    await app.close();
  });

  function object(name: string, text: string) {
    return {name, content: {type: "text/plain", data: Buffer.from(text).toString("base64")}};
  }

  async function contentOf(id: string) {
    const exclusions = policies;
    grant(statements(["*"], []));
    const response = await req.get(`/storage/${id}/view`);
    policies = exclusions;
    return response.statusCode == 200 ? response.body : response.statusCode;
  }

  const operations: [string, (idOrName: string) => Promise<{statusCode: number}>][] = [
    ["show", target => req.get(`/storage/${target}`)],
    ["view", target => req.get(`/storage/${target}/view`)],
    ["delete", target => req.delete(`/storage/${target}`)],
    ["bulk delete", target => req.delete("/storage", [target])]
  ];

  const idOnlyOperations: [string, (id: string) => Promise<{statusCode: number}>][] = [
    [
      "patch",
      id =>
        req.patch(
          `/storage/${id}`,
          {name: "renamed.txt"},
          {"Content-Type": "application/merge-patch+json"}
        )
    ],
    [
      "put",
      id =>
        req.put(`/storage/${id}`, object(id == secretId ? "secret.txt" : "open.txt", "overwritten"))
    ]
  ];

  describe("an object excluded by its name", () => {
    beforeEach(() => grant(statements(["*"], ["secret*"])));

    it.each([...operations, ...idOnlyOperations])(
      "should refuse %s addressed by id",
      async (_, operation) => {
        const response = await operation(secretId);

        expect(response.statusCode).toEqual(403);
        expect(await contentOf(secretId)).toEqual("secret");
      }
    );

    it.each(operations)("should refuse %s addressed by name", async (_, operation) => {
      const response = await operation("secret.txt");

      expect(response.statusCode).toEqual(403);
      expect(await contentOf(secretId)).toEqual("secret");
    });

    it.each([...operations, ...idOnlyOperations])(
      "should keep allowing %s on another object by id",
      async (_, operation) => {
        const response = await operation(openId);

        expect(response.statusCode).toBeLessThan(300);
      }
    );
  });

  describe("an object excluded by its id", () => {
    beforeEach(() => grant(statements(["*"], [secretId])));

    it.each(operations)("should refuse %s addressed by name", async (_, operation) => {
      const response = await operation("secret.txt");

      expect(response.statusCode).toEqual(403);
      expect(await contentOf(secretId)).toEqual("secret");
    });

    it.each([...operations, ...idOnlyOperations])(
      "should refuse %s addressed by id",
      async (_, operation) => {
        expect((await operation(secretId)).statusCode).toEqual(403);
      }
    );

    it.each(operations)(
      "should keep allowing %s on another object by name",
      async (_, operation) => {
        expect((await operation("open.txt")).statusCode).toBeLessThan(300);
      }
    );
  });

  describe("other rules", () => {
    it("should delete nothing when one object of a bulk delete is excluded", async () => {
      grant(statements(["*"], ["secret*"]));

      const response = await req.delete("/storage", [openId, secretId]);

      expect(response.statusCode).toEqual(403);
      expect(await contentOf(openId)).toEqual("open");
    });

    it("should keep an include list of ids working by id only", async () => {
      grant(statements([openId], []));

      expect((await req.get(`/storage/${openId}/view`)).statusCode).toEqual(200);
      expect((await req.get("/storage/open.txt/view")).statusCode).toEqual(403);
      expect((await req.get(`/storage/${secretId}/view`)).statusCode).toEqual(403);
    });

    it("should keep access granted by another statement that does not exclude the object", async () => {
      grant(statements(["*"], ["secret*"]), statements([secretId], []));

      expect((await req.get(`/storage/${secretId}/view`)).statusCode).toEqual(200);
    });

    it("should not let a grant for another object lift an exclusion", async () => {
      grant(statements(["*"], ["secret*"]), statements([openId], []));

      expect((await req.get(`/storage/${secretId}/view`)).statusCode).toEqual(403);
    });

    it("should still answer 404 for an unknown object", async () => {
      grant(statements(["*"], ["secret*"]));

      expect((await req.get("/storage/nope.txt")).statusCode).toEqual(404);
      expect((await req.get("/storage/nope.txt/view")).statusCode).toEqual(404);
    });
  });
});
