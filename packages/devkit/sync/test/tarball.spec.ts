import zlib from "zlib";
import {readTarball} from "../src/tarball";

type TarFile = {path: string; content?: string; type?: string; pax?: boolean; longname?: boolean};

function header(name: string, size: number, typeflag: string): Buffer {
  const block = Buffer.alloc(512);
  block.write(name.slice(0, 100), 0, "utf-8");
  block.write("0000644\0", 100);
  block.write("0000000\0", 108);
  block.write("0000000\0", 116);
  block.write(size.toString(8).padStart(11, "0") + "\0", 124);
  block.write("00000000000\0", 136);
  block.write(typeflag, 156);
  block.write("ustar\0", 257);
  block.write("00", 263);
  block.fill(" ", 148, 156);
  let sum = 0;
  for (const byte of block) sum += byte;
  block.write(sum.toString(8).padStart(6, "0") + "\0 ", 148);
  return block;
}

function withPadding(body: Buffer): Buffer {
  const pad = (512 - (body.length % 512)) % 512;
  return Buffer.concat([body, Buffer.alloc(pad)]);
}

function paxRecord(key: string, value: string): string {
  const base = ` ${key}=${value}\n`;
  let length = base.length + 1;
  while (String(length).length + base.length !== length)
    length = String(length).length + base.length;
  return `${length}${base}`;
}

function tar(files: TarFile[]): Buffer {
  const parts: Buffer[] = [header("pax_global_header", 0, "g")];
  for (const file of files) {
    const body = Buffer.from(file.content ?? "", "utf-8");
    let name = file.path;
    if (file.pax) {
      const pax = Buffer.from(paxRecord("path", file.path), "utf-8");
      parts.push(header("PaxHeader", pax.length, "x"), withPadding(pax));
      name = "truncated-name";
    }
    if (file.longname) {
      const long = Buffer.from(file.path + "\0", "utf-8");
      parts.push(header("././@LongLink", long.length, "L"), withPadding(long));
      name = "truncated-name";
    }
    parts.push(header(name, body.length, file.type ?? "0"), withPadding(body));
  }
  parts.push(Buffer.alloc(1024));
  return Buffer.concat(parts);
}

async function* chunked(buffer: Buffer, size: number) {
  for (let i = 0; i < buffer.length; i += size) yield buffer.subarray(i, i + size);
}

const ROOT = "owner-repo-abc1234";

describe("readTarball", () => {
  const archive = tar([
    {path: `${ROOT}/`, type: "5"},
    {path: `${ROOT}/bucket/Users/schema.yaml`, content: "title: Users\n"},
    {path: `${ROOT}/function/hello/schema.yaml`, content: "name: hello\n"},
    {path: `${ROOT}/function/hello/index.ts`, content: "export default () => 1;"},
    {path: `${ROOT}/function/hello/package.json`, content: "{}"},
    {path: `${ROOT}/function/hello/node_modules/x/index.js`, content: "ignored"},
    {path: `${ROOT}/function/hello/notes.md`, content: "ignored"},
    {path: `${ROOT}/README.md`, content: "ignored"},
    {path: `${ROOT}/unknown/Thing/schema.yaml`, content: "ignored"},
    {path: `${ROOT}/policy/Link/schema.yaml`, type: "2"}
  ]);

  const expected = new Map([
    ["bucket/Users/schema.yaml", "title: Users\n"],
    ["function/hello/schema.yaml", "name: hello\n"],
    ["function/hello/index.ts", "export default () => 1;"],
    ["function/hello/package.json", "{}"]
  ]);

  it("keeps only resource files and strips the archive root folder", async () => {
    expect(await readTarball(archive)).toEqual(expected);
  });

  it("reads gzipped archives", async () => {
    expect(await readTarball(zlib.gzipSync(archive))).toEqual(expected);
  });

  it("reads archives streamed in small chunks", async () => {
    expect(await readTarball(chunked(zlib.gzipSync(archive), 7))).toEqual(expected);
    expect(await readTarball(chunked(archive, 100))).toEqual(expected);
  });

  it("reads from a sub folder", async () => {
    const monorepo = tar([
      {path: `${ROOT}/bucket/Root/schema.yaml`, content: "title: Root\n"},
      {path: `${ROOT}/apps/spica/bucket/Nested/schema.yaml`, content: "title: Nested\n"}
    ]);
    const files = await readTarball(monorepo, {path: "/apps/spica/"});
    expect(files).toEqual(new Map([["bucket/Nested/schema.yaml", "title: Nested\n"]]));
  });

  it("uses pax and GNU long names", async () => {
    const longSlug = "a".repeat(120);
    const archive = tar([
      {path: `${ROOT}/bucket/${longSlug}/schema.yaml`, content: "title: pax\n", pax: true},
      {path: `${ROOT}/policy/${longSlug}/schema.yaml`, content: "name: gnu\n", longname: true},
      {path: `${ROOT}/secret/Short/schema.yaml`, content: "key: s\n"}
    ]);
    expect(await readTarball(archive)).toEqual(
      new Map([
        [`bucket/${longSlug}/schema.yaml`, "title: pax\n"],
        [`policy/${longSlug}/schema.yaml`, "name: gnu\n"],
        ["secret/Short/schema.yaml", "key: s\n"]
      ])
    );
  });

  it("rejects a resource file larger than the limit", async () => {
    await expect(readTarball(archive, {maxFileBytes: 5})).rejects.toThrow(
      '"bucket/Users/schema.yaml" is 13 bytes'
    );
  });

  it("does not count skipped files against the limits", async () => {
    const big = tar([
      {path: `${ROOT}/node_modules/huge.js`, content: "x".repeat(10_000)},
      {path: `${ROOT}/bucket/Users/schema.yaml`, content: "title: Users\n"}
    ]);
    const files = await readTarball(big, {maxFileBytes: 100, maxTotalBytes: 100});
    expect(files.size).toBe(1);
  });

  it("rejects when the total size or file count is exceeded", async () => {
    await expect(readTarball(archive, {maxTotalBytes: 20})).rejects.toThrow("byte limit");
    await expect(readTarball(archive, {maxFiles: 2})).rejects.toThrow("2 file limit");
  });

  it("rejects an archive cut off inside an entry", async () => {
    const cut = archive.subarray(0, 512 * 3 + 100);
    await expect(readTarball(cut)).rejects.toThrow("truncated");
  });

  it("rejects an archive cut off between entries", async () => {
    const cut = archive.subarray(0, 512 * 4);
    await expect(readTarball(cut)).rejects.toThrow("truncated");
  });

  it("rejects an empty input", async () => {
    await expect(readTarball(chunked(Buffer.alloc(0), 10))).rejects.toThrow("truncated");
  });
});
