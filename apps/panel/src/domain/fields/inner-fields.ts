import {initForm} from ".";
import {FieldKind, type FieldFormState, type FieldCreationForm} from "./types";

interface AddInnerFieldOptions {
  seed?: Partial<FieldCreationForm & {type?: FieldKind}>;
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