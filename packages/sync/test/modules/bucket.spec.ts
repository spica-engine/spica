import os from "os";
import path from "path";
import fs from "fs";
import yaml from "yaml";
import {bucketModule} from "@spica-server/sync";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "spica-bucket-test-"));
}

function cleanup(dir: string) {
  fs.rmSync(dir, {recursive: true, force: true});
}

const mockHttp = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn()
} as any;

beforeEach(() => jest.clearAllMocks());

describe("bucketModule.readLocal", () => {
  it("returns empty array when bucket dir does not exist", async () => {
    const dir = makeTmpDir();
    try {
      const result = await bucketModule.readLocal(dir);
      expect(result).toEqual([]);
    } finally {
      cleanup(dir);
    }
  });

  it("reads schema.yaml files from bucket subfolders", async () => {
    const dir = makeTmpDir();
    try {
      const bucketDir = path.join(dir, "bucket", "Pages");
      fs.mkdirSync(bucketDir, {recursive: true});
      fs.writeFileSync(
        path.join(bucketDir, "schema.yaml"),
        yaml.stringify({title: "Pages", description: "test", properties: {name: {type: "string"}}})
      );

      const result = await bucketModule.readLocal(dir);
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe("Pages");
      expect(result[0].data.title).toBe("Pages");
    } finally {
      cleanup(dir);
    }
  });

  it("skips folders without schema.yaml", async () => {
    const dir = makeTmpDir();
    try {
      const bucketDir = path.join(dir, "bucket", "Empty");
      fs.mkdirSync(bucketDir, {recursive: true});

      const result = await bucketModule.readLocal(dir);
      expect(result).toHaveLength(0);
    } finally {
      cleanup(dir);
    }
  });
});

describe("bucketModule.readRemote", () => {
  it("maps remote buckets to slugged resources using title", async () => {
    mockHttp.get.mockResolvedValue([
      {_id: "id1", title: "Pages", properties: {}},
      {_id: "id2", title: "Users", properties: {}}
    ]);

    const result = await bucketModule.readRemote(mockHttp);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({slug: "Pages", id: "id1"});
    expect(result[1]).toMatchObject({slug: "Users", id: "id2"});
    expect(mockHttp.get).toHaveBeenCalledWith("bucket");
  });
});

describe("bucketModule.create", () => {
  it("POSTs bucket data", async () => {
    mockHttp.post.mockResolvedValue({});
    await bucketModule.create(mockHttp, {slug: "Pages", data: {title: "Pages"} as any});
    expect(mockHttp.post).toHaveBeenCalledWith("bucket", {title: "Pages"});
  });
});

describe("bucketModule.update", () => {
  it("PUTs bucket data with remoteId", async () => {
    mockHttp.put.mockResolvedValue({});
    await bucketModule.update(mockHttp, {slug: "Pages", data: {title: "Pages"} as any}, "abc123");
    expect(mockHttp.put).toHaveBeenCalledWith("bucket/abc123", {title: "Pages"});
  });
});

describe("bucketModule.delete", () => {
  it("DELETEs bucket by remoteId", async () => {
    mockHttp.delete.mockResolvedValue({});
    await bucketModule.delete(mockHttp, "abc123");
    expect(mockHttp.delete).toHaveBeenCalledWith("bucket/abc123");
  });
});

describe("bucketModule.writeLocal", () => {
  it("creates schema.yaml under bucket/<slug>/", async () => {
    const dir = makeTmpDir();
    try {
      await bucketModule.writeLocal(dir, {
        slug: "Pages",
        id: "id1",
        data: {title: "Pages", properties: {}} as any
      });

      const filePath = path.join(dir, "bucket", "Pages", "schema.yaml");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = yaml.parse(fs.readFileSync(filePath, "utf-8"));
      expect(content.title).toBe("Pages");
    } finally {
      cleanup(dir);
    }
  });
});

describe("bucketModule.deleteLocal", () => {
  it("removes bucket/<slug>/ directory", async () => {
    const dir = makeTmpDir();
    try {
      const bucketDir = path.join(dir, "bucket", "Pages");
      fs.mkdirSync(bucketDir, {recursive: true});
      fs.writeFileSync(path.join(bucketDir, "schema.yaml"), "title: Pages\n");

      await bucketModule.deleteLocal(dir, "Pages");
      expect(fs.existsSync(bucketDir)).toBe(false);
    } finally {
      cleanup(dir);
    }
  });
});

describe("bucketModule.diffFields", () => {
  it("returns changed field names excluding _id", () => {
    const local = {title: "Pages", description: "old", _id: "local"} as any;
    const remote = {title: "Pages", description: "new", _id: "remote"} as any;
    const changed = bucketModule.diffFields(local, remote);
    expect(changed).toContain("description");
    expect(changed).not.toContain("_id");
  });
});
