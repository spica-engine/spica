import {ObjectId} from "@spica-server/database";
import {RelationMap} from "@spica-server/interface-bucket-common";

/** Reading documents by id from a target collection; supplied by the caller. */
export type CandidateRelationReader = (
  target: string,
  ids: ObjectId[]
) => Promise<Record<string, unknown>[]>;

/**
 * Resolves a **candidate** document's relations in the application layer — for evaluating the write rule.
 *
 * **Why it exists.** A write rule (`acl.write`) can reference related fields
 * (`document.event.title == "x"`) and the rule is evaluated in JS, so it needs the document with its
 * relations resolved. This used to be done by using the collection as a **calculation engine**:
 *
 * ```
 * [{$limit: 1}, {$replaceWith: {$literal: document}}, ...$lookup stages]
 * ```
 *
 * That is, an arbitrary row was taken and thrown away, the candidate document was put in its place, and
 * the relations were resolved with `$lookup`. It had two problems:
 *
 * 1. **It only works on MongoDB.** `$replaceWith` and `$lookup` are driver-specific stages; PostgreSQL
 *    rejects them and **no** bucket carrying a write rule in its schema could be written to.
 * 2. **It is broken on MongoDB too when the collection is empty.** When `$limit: 1` returns no row the
 *    pipeline stays empty and `fullDocument` becomes `null`; the rule cannot be evaluated while the
 *    first document is being inserted.
 *
 * What was needed was computation rather than a read; hence the resolution lives in the application
 * layer. **One** query is issued per target (no N+1) — the same decision made for
 * `provideLanguageFinalizer`, `function/crud` and `bucket/cache`.
 */
export async function resolveCandidateRelations(
  document: Record<string, unknown>,
  map: RelationMap[],
  read: CandidateRelationReader
): Promise<Record<string, unknown>> {
  if (!map.length) {
    return document;
  }

  const resolved: Record<string, unknown> = {...document};

  for (const relation of map) {
    const raw = valueAtPath(resolved, relation.path);
    const ids = toObjectIds(raw);

    if (!ids.length) {
      continue;
    }

    const documents = await read(relation.target, ids);
    const byId = new Map(documents.map(target => [String(target._id), target]));

    /**
     * Nested relations are resolved **recursively**: a rule such as `document.a.b.title` also wants the
     * `b` in `a`'s target. `RelationMap.children` already carries that tree.
     */
    const hydrate = async (target: Record<string, unknown>) =>
      relation.children?.length
        ? resolveCandidateRelations(target, relation.children, read)
        : target;

    const value =
      relation.type === "onetomany"
        ? await Promise.all(
            ids
              .map(id => byId.get(String(id)))
              .filter(Boolean)
              .map(hydrate)
          )
        : await (async () => {
            const target = byId.get(String(ids[0]));
            return target ? hydrate(target) : undefined;
          })();

    /**
     * When there is no match the field is **left as it is** and `undefined` is not written: the
     * `$lookup` + `$unwind` on MongoDB also left the field with its id on an unmatched relation, and the
     * rule saw it that way.
     */
    if (value !== undefined) {
      setValueAtPath(resolved, relation.path, value);
    }
  }

  return resolved;
}

/** The value at a dotted path; `undefined` when an intermediate level is missing. */
function valueAtPath(document: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce<any>((value, key) => (value == null ? value : value[key]), document);
}

/** Writes a value at a dotted path, walking down by **copying** the intermediate objects (so the candidate document is not mutated). */
function setValueAtPath(document: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split(".");
  const last = segments.pop()!;

  let cursor: any = document;
  for (const segment of segments) {
    cursor[segment] = {...(cursor[segment] as object)};
    cursor = cursor[segment];
  }
  cursor[last] = value;
}

/**
 * A relation value can be a single id or an array of ids; both are normalized to `ObjectId`. Invalid
 * values are skipped — this is user input and validating it is another layer's job.
 */
function toObjectIds(value: unknown): ObjectId[] {
  const raw = Array.isArray(value) ? value : [value];

  return raw
    .filter(item => item !== null && item !== undefined)
    .map(item => {
      try {
        return new ObjectId(item as string);
      } catch {
        return undefined;
      }
    })
    .filter((id): id is ObjectId => id !== undefined);
}
