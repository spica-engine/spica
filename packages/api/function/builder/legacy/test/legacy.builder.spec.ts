import {LegacyBuilder} from "@spica-server/function-builder-legacy";

describe("LegacyBuilder", () => {
  it("should expose the description of the language it was created with", () => {
    expect(new LegacyBuilder("javascript").description.entrypoints).toEqual({
      build: "index.mjs",
      runtime: "index.mjs"
    });
    expect(new LegacyBuilder("typescript").description.entrypoints).toEqual({
      build: "index.ts",
      runtime: "index.mjs"
    });
  });

  it("should throw for an unsupported language", () => {
    const builder = new LegacyBuilder("brainfuck");
    expect(() => builder.description).toThrow(
      `Language "brainfuck" is not supported by LegacyBuilder.`
    );
  });
});
