import {levenshtein, SequenceKind} from "./levenshtein";

describe("levenstein", () => {
  it("should return 2-dist, insert at last", () => {
    const moves = levenshtein(["1", "2", "3", "4", "5", "6", "7"], ["1", "2", "3", "4", "5"]);
    expect(moves.distance).toBe(2);
    expect(moves.sequence).toEqual([
      {kind: SequenceKind.Insert, item: "7", at: 6},
      {kind: SequenceKind.Insert, item: "6", at: 5}
    ]);
  });

  it("should return 1-dist, insert at middle", () => {
    const moves = levenshtein(["1", "2", "3", "15", "5", "6", "7"], ["1", "2", "3", "5", "6", "7"]);
    expect(moves.distance).toBe(1);
    expect(moves.sequence).toEqual([{kind: SequenceKind.Insert, item: "15", at: 3}]);
  });

  it("should return 1-dist, delete at middle", () => {
    const moves = levenshtein(["1", "2", "3", "5", "6", "7"], ["1", "2", "3", "15", "5", "6", "7"]);
    expect(moves.distance).toBe(1);
    expect(moves.sequence).toEqual([{kind: SequenceKind.Delete, item: "15", at: 3}]);
  });

  it("should return 2-dist, substitution at middle", () => {
    const moves = levenshtein(["1", "2", "4", "3", "5", "6"], ["1", "2", "3", "4", "5", "6"]);
    expect(moves.distance).toBe(2);
    expect(moves.sequence).toEqual([
      {kind: SequenceKind.Substitute, item: "4", with: "3", at: 3},
      {kind: SequenceKind.Substitute, item: "3", with: "4", at: 2}
    ]);
  });

  it("should return 3-dist, substitution at middle and insert at last", () => {
    const moves = levenshtein(["1", "2", "4", "3", "5", "6", "7"], ["1", "2", "3", "4", "5", "6"]);
    expect(moves.distance).toBe(3);
    expect(moves.sequence).toEqual([
      {kind: SequenceKind.Insert, item: "7", at: 6},
      {kind: SequenceKind.Substitute, item: "4", with: "3", at: 3},
      {kind: SequenceKind.Substitute, item: "3", with: "4", at: 2}
    ]);
  });

  it("should return 2-dist, delete at middle and insert at last", () => {
    const moves = levenshtein(["1", "2", "3", "5", "6", "7"], ["1", "2", "3", "4", "5", "6"]);
    expect(moves.distance).toBe(2);
    expect(moves.sequence).toEqual([
      {kind: SequenceKind.Insert, item: "7", at: 5},
      {kind: SequenceKind.Delete, item: "4", at: 3}
    ]);
  });

  it("should diff mixed arrays", () => {
    const moves = levenshtein(["2", "4", "3", "1"], ["4", "3", "2", "1"]);
    expect(moves.distance).toBe(2);
    expect(moves.sequence).toEqual([
      {kind: SequenceKind.Delete, item: "2", at: 2},
      {kind: SequenceKind.Insert, item: "2", at: 0}
    ]);
  });
});
