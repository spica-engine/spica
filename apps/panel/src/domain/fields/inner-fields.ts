import {initForm} from ".";
import {FieldKind, type FieldFormState, type InnerField} from "./types";

export function addInnerField(
  parent: FieldFormState,
  kind: FieldKind,
  initialValues?: FieldFormState
): FieldFormState {
  const child = initForm(kind, initialValues);
  const id = crypto.randomUUID(); // crypto is fine for now, but not supported in some older browsers
  const nextChild = {...child, id};
  return {
    ...parent,
    innerFields: [...(parent.innerFields || []), nextChild]
  } as FieldFormState;
}

export function updateInnerField(parent: FieldFormState, updated: InnerField): FieldFormState {
  if (!parent.innerFields) return parent;
  return {
    ...parent,
    innerFields: parent.innerFields.map(f => (f.id === updated.id ? updated : f))
  } as FieldFormState;
}

export function removeInnerField(parent: FieldFormState, childId: string): FieldFormState {
  if (!parent.innerFields) return parent;
  return {
    ...parent,
    innerFields: parent.innerFields.filter(f => f.id !== childId)
  } as FieldFormState;
}
