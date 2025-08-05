import {Default} from "@spica-server/storage/src/strategy/default";
import fs from "fs";
import path from "path";

describe("Default", () => {
  let service: Default;
  beforeEach(() => {
    service = new Default(
      path.join(process.env.TEST_TMPDIR, Date.now().toString()),
      "http://insteadof",
      0
    );
  });

  it("should create the directory", async () => {
    expect(fs.existsSync(service["path"])).toEqual(true);
  });

  it("should return url", async () => {
    expect(await service.url("test_file")).toEqual("http://insteadof/storage/test_file/view");
  });

  it("should return build path", () => {
    expect(service["buildPath"]("test_file2")).toEqual(`${service["path"]}/test_file2`);
  });

  it("should write and read file", async () => {
    await service.write("file_1", Buffer.from("123"));
    const file = await service.read("file_1");
    expect(file.toString()).toEqual("123");
  });

  it("should delete file", async () => {
    await service.write("file_2", Buffer.from("123"));
    await service.delete("file_2");
    expect(await service.read("file_2").catch(() => "doesnotexist")).toBe("doesnotexist");
  });
});
