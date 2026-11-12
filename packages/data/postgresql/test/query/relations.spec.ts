import {BadRequestException} from "@nestjs/common";
import {describeBucket} from "@spica-server/data-postgresql";
import {buildRelationTree} from "../../src/query/bucket/relations";
import {
  bucketId,
  otherBucket,
  otherId,
  otherMetadata,
  ruleBucket,
  ruleMetadata,
  thirdBucket,
  thirdId,
  targets
} from "../access/rule-fixtures";

const thirdMetadata = describeBucket(thirdId, thirdBucket, targets);

const described: Record<string, any> = {
  [otherId]: {bucket: otherBucket, metadata: otherMetadata},
  [thirdId]: {bucket: thirdBucket, metadata: thirdMetadata}
};

const describe_ = async (id: string) => described[id];

const tree = (paths: string[][]) => buildRelationTree(ruleBucket, ruleMetadata, paths, describe_);

describe("buildRelationTree", () => {
  it("should ignore a segment after a relation that names no property", async () => {
    const root = await tree([["author", "id"]]);

    expect([...root.edges.keys()]).toEqual(["author"]);
    expect(root.edges.get("author").target.edges.size).toBe(0);
  });

  it("should read a plain path as the relation it names", async () => {
    const root = await tree([["author"]]);

    expect([...root.edges.keys()]).toEqual(["author"]);
    expect(root.edges.get("author")).toMatchObject({path: ["author"], many: false});
  });

  it("should tell one-to-many relations", async () => {
    expect((await tree([["editors"]])).edges.get("editors").many).toBe(true);
  });

  it("should share the edge of paths that start the same way", async () => {
    const root = await tree([["author", "boss"], ["author"], ["editors"]]);

    expect([...root.edges.keys()]).toEqual(["author", "editors"]);
    expect([...root.edges.get("author").target.edges.keys()]).toEqual(["boss"]);
    expect(root.edges.get("author").target.metadata).toBe(otherMetadata);
  });

  it("should ignore paths that do not lead to a relation", async () => {
    const root = await tree([["title"], ["nope"], ["address"], []]);
    expect(root.edges.size).toBe(0);
  });

  it("should ignore a relation whose bucket is gone", async () => {
    const root = await buildRelationTree(
      ruleBucket,
      ruleMetadata,
      [["author"]],
      async () => undefined
    );
    expect(root.edges.size).toBe(0);
  });

  describe("depth", () => {
    const selfBucket: any = {
      id: bucketId,
      primary: "id",
      properties: {
        id: {type: "uuid", options: {generated: true}},
        next: {type: "relation", bucketId, relationType: "onetoone"}
      }
    };
    const selfMetadata = describeBucket(bucketId, selfBucket, () => ({
      table: ruleMetadata.main.name,
      primaryKey: ruleMetadata.primaryKey
    }));
    const hops = (count: number) => Array(count).fill("next");
    const chain = (count: number) =>
      buildRelationTree(selfBucket, selfMetadata, [hops(count)], async () => ({
        bucket: selfBucket,
        metadata: selfMetadata
      }));

    it("should follow a relation to itself as deep as the limit", async () => {
      let node = await chain(5);
      for (let level = 0; level < 5; level++) {
        node = node.edges.get("next").target;
      }
      expect(node.edges.size).toBe(0);
    });

    it("should refuse to go deeper than the limit", async () => {
      await expect(chain(6)).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
