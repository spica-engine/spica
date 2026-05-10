import {sanitizeSlug, unwrapList} from "@spica/cli/src/commands/sync/fs-utils";

// ─── sanitizeSlug ─────────────────────────────────────────────────────────────

describe("sanitizeSlug", () => {
  it("returns a plain slug unchanged", () => {
    expect(sanitizeSlug("my-bucket")).toBe("my-bucket");
  });

  it("strips directory traversal sequences", () => {
    expect(sanitizeSlug("../../.ssh/authorized_keys")).toBe("authorized_keys");
  });

  it("strips a leading absolute path", () => {
    expect(sanitizeSlug("/etc/passwd")).toBe("passwd");
  });

  it("strips subdirectory components", () => {
    expect(sanitizeSlug("sub/dir/name")).toBe("name");
  });

  it("handles a name with dots but no traversal", () => {
    expect(sanitizeSlug("my.bucket")).toBe("my.bucket");
  });

  it("handles a slug that is already just a basename", () => {
    expect(sanitizeSlug("Users")).toBe("Users");
  });

  it("strips mixed slash styles", () => {
    // path.normalize converts \\ on POSIX too in some cases; basename is the safe guard
    expect(sanitizeSlug("some/../other/resource")).toBe("resource");
  });
});

// ─── unwrapList ───────────────────────────────────────────────────────────────

describe("unwrapList", () => {
  it("returns a plain array as-is", () => {
    const arr = [{id: 1}, {id: 2}];
    expect(unwrapList(arr)).toBe(arr);
  });

  it("unwraps a paginated { data: [...] } response", () => {
    const items = [{key: "A"}, {key: "B"}];
    expect(unwrapList({data: items})).toEqual(items);
  });

  it("returns an empty array when data is undefined", () => {
    expect(unwrapList({} as any)).toEqual([]);
  });

  it("returns an empty array when data is an empty array", () => {
    expect(unwrapList({data: []})).toEqual([]);
  });

  it("returns a plain empty array as-is", () => {
    expect(unwrapList([])).toEqual([]);
  });
});
