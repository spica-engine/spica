/**
 * Inner Field Management Helpers
 * ------------------------------------------------------------
 * Pure, immutable operations for nested (object / array-of-object)
 * field editing flows. Replaces UI-layer mutation logic.
 */
import {initForm} from ".";
import {FieldKind, type FieldFormState, type FieldFormDefaults} from "./types";

interface AddInnerFieldOptions {
  seed?: Partial<FieldFormDefaults & {type?: FieldKind}>;
  idFactory?: () => string; // injectable for determinism if needed
}

export function addInnerField(
  parent: FieldFormState,
  kind: FieldKind,
  opts: AddInnerFieldOptions = {}
): FieldFormState {
  const child = initForm(kind, {inner: true, initial: opts.seed}) as any;
  const id = opts.idFactory ? opts.idFactory() : crypto.randomUUID();
  const nextChild = {...child, id};
  return {
    ...parent,
    innerFields: [...(parent.innerFields || []), nextChild]
  } as FieldFormState;
}

export function updateInnerField(parent: FieldFormState, updated: any): FieldFormState {
  if (!parent.innerFields) return parent;
  return {
    ...parent,
    innerFields: parent.innerFields.map(f => ((f as any).id === (updated as any).id ? updated : f))
  } as FieldFormState;
}

export function removeInnerField(parent: FieldFormState, childId: string): FieldFormState {
  if (!parent.innerFields) return parent;
  return {
    ...parent,
    innerFields: parent.innerFields.filter(f => (f as any).id !== childId)
  } as FieldFormState;
}

interface ListForbiddenNamesOptions {
  existingOuterNames?: string[]; // field names already used in bucket (for root mode)
  excludeIds?: string[]; // inner field IDs to ignore (e.g., being edited)
  mode: "root" | "inner";
}

/**
 * Compute reserved / forbidden names for validation context.
 * - root mode: combines existing bucket property names + current form title if present.
 * - inner mode: all inner field titles except excluded IDs.
 */
export function listForbiddenNames(
  parent: FieldFormState,
  opts: ListForbiddenNamesOptions
): string[] {
  if (opts.mode === "root") {
    return [...new Set([...(opts.existingOuterNames || [])])];
  }
  const inner = (parent.innerFields || [])
    .filter(f => !opts.excludeIds || !opts.excludeIds.includes((f as any).id))
    .map(f => (f as any).fieldValues?.title)
    .filter(Boolean);
  return [...new Set(inner as string[])];
}
