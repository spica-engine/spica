import fs from "fs";
import os from "os";
import path from "path";
import {resourceInstaller} from "../src/resources";
import {HttpClient} from "../src/http";

// Two buckets on disk; "Bad" fails to create, "Good" succeeds. Drives the real sync engine
// (no mocking of @spica-server/sync) so the abortOnError contract is verified end to end.
function makeProject(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "devkit-install-"));
  const write = (title: string) => {
    const dir = path.join(root, "bucket", title.toLowerCase());
    fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(path.join(dir, "schema.yaml"), `title: ${title}\nproperties: {}\n`);
  };
  write("Bad");
  write("Good");
  return root;
}

function fakeHttp(onCreate: (data: any) => void): HttpClient {
  const ok = async () => [] as any; // every readRemote sees an empty instance → everything is a create
  return {
    get: ok,
    head: ok,
    delete: ok,
    put: async () => ({}) as any,
    patch: async () => ({}) as any,
    post: async (_url: string, data?: any) => {
      onCreate(data);
      if (data?.title === "Bad") {
        const err: any = new Error("boom");
        err.response = {status: 500};
        throw err;
      }
      return {} as any;
    }
  };
}

describe("resourceInstaller.install", () => {
  let root: string;
  beforeAll(() => (root = makeProject()));
  afterAll(() => fs.rmSync(root, {recursive: true, force: true}));

  it("is best-effort by default: a failing resource is collected, the rest still install", async () => {
    const created: string[] = [];
    const http = fakeHttp(d => created.push(d.title));

    const {errors} = await resourceInstaller.install(http, root);

    // did not throw; the bad one is reported…
    expect(errors.length).toBe(1);
    expect(errors[0]).toMatch(/bad/i);
    // …and the good one was still attempted (not short-circuited by the failure)
    expect(created).toEqual(expect.arrayContaining(["Bad", "Good"]));
  });

  it("aborts on the first failure when abortOnError is set", async () => {
    const http = fakeHttp(() => {});
    await expect(resourceInstaller.install(http, root, {abortOnError: true})).rejects.toThrow(/bad/i);
  });
});
