import {Change, ChangeKind} from "../../../../../../libs/interface/core";
import {JSONSchema7} from "json-schema";
import {Path} from "./path";
import diffMatchPatch from "diff-match-patch";

export function applyPatch<T>(changes: Change[], document: T, schema: JSONSchema7) {
  const patcher = new diffMatchPatch.diff_match_patch();
  changes.forEach(change => {
    switch (change.kind) {
      case ChangeKind.Delete:
        Path.unset(document, change.path);
        break;
      case ChangeKind.Add:
      case ChangeKind.Edit:
        const type = Path.type(change.path, schema);
        let val: string | number | boolean = patcher.patch_apply(
          change.patches as unknown as (new () => diffMatchPatch.patch_obj)[], // patch_apply function type and implementation do not match
          String(Path.get(change.path, document))
        )[0];
        switch (type) {
          case "number":
            val = Number(val);
            break;
          case "boolean":
            val = val == "true";
            break;
          case "string":
            // Noop. the value is already string
            break;
          default:
            throw new Error(
              `Can not coerce the type ${type}. This usually happens when schema contains custom types.`
            );
        }
        Path.set(document, change.path, val);
        break;
      default:
        break;
    }
  });
}
