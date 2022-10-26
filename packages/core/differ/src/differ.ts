import * as deepDiff from "deep-diff";
import * as diffMatchPatch from "diff-match-patch";

export function diff<T>(prev: T, current: T): Change[] {
  const structuralChanges = deepDiff.diff(prev, current);

  if (!structuralChanges) {
    return [];
  }

  function normalize(rootchange: deepDiff.DiffNew<Object | Array<any>>) {
    let prev: Object | Array<any>;

    if (Array.isArray(rootchange.rhs)) {
      prev = [];
    } else if (typeof rootchange.rhs == "object" && rootchange.rhs != null) {
      prev = {};
    }

    if (prev) {
      const diff = deepDiff.diff(prev, rootchange.rhs);

      if (!diff) {
        return [];
      }
      return diff
        .reduce((changes, change) => changes.concat(mapChanges(change)), new Array<Change>())
        .map(change => {
          if (change.kind == ChangeKind.Edit) {
            change.kind = ChangeKind.Add;
          }
          change.path = rootchange.path
            ? rootchange.path.concat(change.path).filter(path => path != undefined)
            : change.path;
          return change;
        });
    } else {
      return [
        {
          kind: ChangeKind.Add,
          path: rootchange.path,
          patches: createPatch("", rootchange.rhs as string)
        } as Change
      ];
    }
  }

  function mapChanges(diff: deepDiff.Diff<Object>): Change[] {
    switch (diff.kind) {
      case "E":
        return [
          {
            kind: ChangeKind.Edit,
            path: diff.path,
            patches: createPatch(diff.lhs as string, diff.rhs as string)
          } as Change
        ];
      case "A":
        return mapChanges(diff.item).map(change => {
          change.path = new Array<ChangePath>()
            .concat(diff.path)
            .concat(diff.index)
            .concat(change.path)
            .filter(path => path != undefined);

          return change;
        });

      case "D":
        return [
          {
            kind: ChangeKind.Delete,
            path: diff.path
          } as Change
        ];
      case "N":
        return normalize(diff);
    }
  }
  const changes = structuralChanges.reduce(
    (changes, change) => changes.concat(mapChanges(change)),
    []
  );
  return changes;
}

export enum ChangeKind {
  Edit = 1,
  Delete = 2,
  Add = 0
}

export type ChangePath = string | number;
export type ChangePaths = ChangePath[];

export interface Change {
  kind: ChangeKind;
  path: ChangePaths;
  patches?: Patch[];
}

export function createPatch(previous: string, current: string): Patch[] {
  const differ = new diffMatchPatch.diff_match_patch();
  const patches = differ.patch_make(String(previous), String(current));
  return patches.map(patch => ({...patch}));
}

export class Patch {
  diffs: [number, string][];
  start1: number | null;
  start2: number | null;
  length1: number;
  length2: number;
}

export function compareResourceGroups<T>(
  desired: T[],
  actual: T[],
  comparisonOptions: {
    uniqueField: string;
    ignoredFields: string[];
  } = {
    uniqueField: "_id",
    ignoredFields: []
  }
) {
  const {ignoredFields, uniqueField} = comparisonOptions;

  const existings = actual.filter(target =>
    desired.some(source => source[uniqueField] == target[uniqueField])
  );

  const existingIds = existings.map(existing => existing[uniqueField]);

  const updations = () => {
    const updations = [];
    for (const existing of existings) {
      const source = desired.find(source => source[uniqueField] == existing[uniqueField]);

      const copySource = JSON.parse(JSON.stringify(source));

      if (ignoredFields.length) {
        ignoredFields.forEach(field => {
          delete source[field];
          delete existing[field];
        });
      }

      if (diff(source, existing).length) {
        updations.push(copySource);
      }
    }

    return updations;
  };

  const insertions = () => desired.filter(source => existingIds.indexOf(source[uniqueField]) == -1);

  const deletions = () => actual.filter(target => existingIds.indexOf(target[uniqueField]) == -1);

  return {
    insertions: insertions(),
    updations: updations(),
    deletions: deletions()
  };
}
