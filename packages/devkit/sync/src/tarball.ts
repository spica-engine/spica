import {Readable, pipeline} from "node:stream";
import zlib from "node:zlib";
import {ALL_MODULES} from "@spica-server/sync";

export interface ReadTarballOptions {
  /** Folder inside the archive that holds the Spica project (e.g. "spica"). Default: the root. */
  path?: string;
  /**
   * Leading path segments to drop from every entry. Default 1, because GitHub and GitLab
   * archives wrap everything in a single "<owner>-<repo>-<sha>/" folder.
   */
  stripComponents?: number;
  /** Largest single resource file accepted. Default 5 MiB. */
  maxFileBytes?: number;
  /** Largest total size of the resource files kept. Default 50 MiB. */
  maxTotalBytes?: number;
  /** Most resource files kept. Default 10000. */
  maxFiles?: number;
}

export type TarballInput = Uint8Array | AsyncIterable<Uint8Array>;

const BLOCK = 512;
const MAX_METADATA_BYTES = 1024 * 1024;

const RESOURCE_FILES = new Map(
  ALL_MODULES.map(mod => [mod.name, new Set(mod.watchedFiles ?? ["schema.yaml"])])
);

/**
 * Reads a (gzipped) tar archive of a repository and returns only the files the sync
 * engine reads, keyed by project-relative path (e.g. `bucket/Users/schema.yaml`).
 *
 * The archive is streamed: entries that are not resource files are skipped without
 * being buffered, so committed node_modules, assets or unrelated apps in a monorepo
 * do not count against memory.
 */
export async function readTarball(
  input: TarballInput,
  options: ReadTarballOptions = {}
): Promise<Map<string, string>> {
  const parser = new TarParser(options);
  for await (const chunk of decompress(input)) {
    parser.write(chunk);
  }
  parser.end();
  return parser.files;
}

async function* decompress(input: TarballInput): AsyncIterable<Buffer> {
  const iterator =
    input instanceof Uint8Array ? toAsyncIterator([input]) : input[Symbol.asyncIterator]();
  const first = await iterator.next();
  if (first.done) return;

  const firstChunk = Buffer.from(first.value);
  async function* all() {
    try {
      yield firstChunk;
      for (let next = await iterator.next(); !next.done; next = await iterator.next()) {
        yield Buffer.from(next.value);
      }
    } finally {
      await iterator.return?.();
    }
  }

  if (firstChunk[0] !== 0x1f || firstChunk[1] !== 0x8b) {
    yield* all();
    return;
  }

  const gunzip = zlib.createGunzip();
  pipeline(Readable.from(all()), gunzip, () => {});
  yield* gunzip as AsyncIterable<Buffer>;
}

async function* toAsyncIterator<T>(items: T[]): AsyncIterator<T> {
  for (const item of items) yield item;
}

interface Entry {
  type: "file" | "pax" | "longname" | "skip";
  path?: string;
  chunks: Buffer[];
}

class TarParser {
  readonly files = new Map<string, string>();

  private header = Buffer.alloc(0);
  private entry: Entry | undefined;
  private remaining = 0;
  private padding = 0;
  private ended = false;
  private nextPath: string | undefined;
  private totalBytes = 0;

  private readonly root: string;
  private readonly stripComponents: number;
  private readonly maxFileBytes: number;
  private readonly maxTotalBytes: number;
  private readonly maxFiles: number;

  constructor(options: ReadTarballOptions) {
    this.root = splitPath(options.path ?? "").join("/");
    this.stripComponents = options.stripComponents ?? 1;
    this.maxFileBytes = options.maxFileBytes ?? 5 * 1024 * 1024;
    this.maxTotalBytes = options.maxTotalBytes ?? 50 * 1024 * 1024;
    this.maxFiles = options.maxFiles ?? 10_000;
  }

  write(chunk: Buffer) {
    let offset = 0;
    while (offset < chunk.length && !this.ended) {
      if (this.remaining > 0) {
        const take = Math.min(this.remaining, chunk.length - offset);
        if (this.entry!.type !== "skip")
          this.entry!.chunks.push(chunk.subarray(offset, offset + take));
        this.remaining -= take;
        offset += take;
        if (this.remaining === 0) this.finishEntry();
        continue;
      }
      if (this.padding > 0) {
        const take = Math.min(this.padding, chunk.length - offset);
        this.padding -= take;
        offset += take;
        continue;
      }
      const take = Math.min(BLOCK - this.header.length, chunk.length - offset);
      this.header = Buffer.concat([this.header, chunk.subarray(offset, offset + take)]);
      offset += take;
      if (this.header.length === BLOCK) {
        const header = this.header;
        this.header = Buffer.alloc(0);
        this.readHeader(header);
      }
    }
  }

  // A download cut off between two entries still parses cleanly; without the end marker
  // check the missing resources would be planned as deletions.
  end() {
    if (!this.ended) throw new Error("The archive is truncated.");
  }

  private readHeader(header: Buffer) {
    if (header.every(byte => byte === 0)) {
      this.ended = true;
      return;
    }

    const size = readOctal(header, 124, 12);
    const typeflag = String.fromCodePoint(header[156]);
    const name = readString(header, 0, 100);
    const prefix =
      header.toString("latin1", 257, 262) === "ustar" ? readString(header, 345, 155) : "";
    const headerPath = this.nextPath ?? (prefix ? `${prefix}/${name}` : name);

    if (typeflag === "x" || typeflag === "L") {
      if (size > MAX_METADATA_BYTES)
        throw new Error("The archive has an oversized metadata entry.");
      this.entry = {type: typeflag === "x" ? "pax" : "longname", chunks: []};
    } else {
      this.nextPath = undefined;
      const isFile = typeflag === "0" || typeflag === "\0";
      const resourcePath = isFile ? this.toResourcePath(headerPath) : undefined;
      if (resourcePath) {
        this.accept(resourcePath, size);
        this.entry = {type: "file", path: resourcePath, chunks: []};
      } else {
        this.entry = {type: "skip", chunks: []};
      }
    }

    this.remaining = size;
    this.padding = (BLOCK - (size % BLOCK)) % BLOCK;
    if (size === 0) this.finishEntry();
  }

  private accept(resourcePath: string, size: number) {
    if (size > this.maxFileBytes) {
      throw new Error(
        `"${resourcePath}" is ${size} bytes, larger than the ${this.maxFileBytes} byte limit.`
      );
    }
    this.totalBytes += size;
    if (this.totalBytes > this.maxTotalBytes) {
      throw new Error(`Resource files exceed the ${this.maxTotalBytes} byte limit.`);
    }
    if (this.files.size + 1 > this.maxFiles) {
      throw new Error(`Resource files exceed the ${this.maxFiles} file limit.`);
    }
  }

  private finishEntry() {
    const entry = this.entry!;
    this.entry = undefined;
    const body = Buffer.concat(entry.chunks);

    if (entry.type === "file") {
      this.files.set(entry.path!, body.toString("utf-8"));
    } else if (entry.type === "pax") {
      this.nextPath = readPaxPath(body) ?? this.nextPath;
    } else if (entry.type === "longname") {
      this.nextPath = readString(body, 0, body.length);
    }
  }

  private toResourcePath(entryPath: string): string | undefined {
    const segments = splitPath(entryPath).slice(this.stripComponents);
    const rootSegments = this.root ? this.root.split("/") : [];
    if (rootSegments.some((segment, i) => segments[i] !== segment)) return undefined;

    const relative = segments.slice(rootSegments.length);
    if (relative.length !== 3) return undefined;
    const [moduleName, , fileName] = relative;
    if (!RESOURCE_FILES.get(moduleName)?.has(fileName)) return undefined;
    return relative.join("/");
  }
}

function splitPath(p: string): string[] {
  return p
    .replace(/\\/g, "/")
    .split("/")
    .filter(segment => segment && segment !== ".");
}

function readString(buffer: Buffer, offset: number, length: number): string {
  const slice = buffer.subarray(offset, offset + length);
  const nul = slice.indexOf(0);
  return slice.toString("utf-8", 0, nul === -1 ? slice.length : nul);
}

function readOctal(buffer: Buffer, offset: number, length: number): number {
  if (buffer[offset] & 0x80) {
    throw new Error("The archive has an entry too large to be a resource file.");
  }
  const text = readString(buffer, offset, length).trim();
  return text ? Number.parseInt(text, 8) : 0;
}

// PAX records are "<length> <key>=<value>\n", where <length> counts bytes of the whole record.
function readPaxPath(body: Buffer): string | undefined {
  let offset = 0;
  let found: string | undefined;
  while (offset < body.length) {
    const space = body.indexOf(0x20, offset);
    if (space === -1) break;
    const length = Number.parseInt(body.toString("latin1", offset, space), 10);
    if (!length || length < 0) break;
    const record = body.toString("utf-8", space + 1, offset + length - 1);
    const eq = record.indexOf("=");
    if (eq !== -1 && record.slice(0, eq) === "path") found = record.slice(eq + 1);
    offset += length;
  }
  return found;
}
