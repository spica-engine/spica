import {propRules} from "./propRules";
import {StringEditor} from "./editors/StringEditor";
import {NumberEditor} from "./editors/NumberEditor";
import {BooleanEditor} from "./editors/BooleanEditor";
import {TextareaEditor} from "./editors/TextareaEditor";
import {DateEditor} from "./editors/DateEditor";
import {SelectEditor} from "./editors/SelectEditor";
import {BaseEditor} from "./editors/BaseEditor";
import {PrimaryHandler} from "./handlers/PrimaryHandler";
import {UniqueHandler} from "./handlers/UniqueHandler";
import {RequiredHandler} from "./handlers/RequiredHandler";
import {IndexedHandler} from "./handlers/IndexedHandler";
import {TranslatableHandler} from "./handlers/TranslatableHandler";
import type {EditorProps} from "./types";

const editorMap: Record<string, React.ComponentType<EditorProps>> = {
  string: StringEditor,
  number: NumberEditor,
  boolean: BooleanEditor,
  textarea: TextareaEditor,
  date: DateEditor,
  select: SelectEditor
};

export function buildEditor(type: string): React.ComponentType<EditorProps> {
  const rules = propRules[type];
  const BaseEditorComponent = editorMap[type] || BaseEditor;

  if (!rules) {
    return BaseEditorComponent;
  }

  // Build the chain of responsibility
  const primaryHandler = new PrimaryHandler();
  const uniqueHandler = new UniqueHandler();
  const requiredHandler = new RequiredHandler();
  const indexedHandler = new IndexedHandler();
  const translatableHandler = new TranslatableHandler();

  // Chain order matters - decorators will be applied in reverse order
  primaryHandler
    .setNext(uniqueHandler)
    .setNext(requiredHandler)
    .setNext(indexedHandler)
    .setNext(translatableHandler);

  // Pass the base editor down the chain
  const result = primaryHandler.handle({
    type,
    rules,
    Editor: BaseEditorComponent
  });

  return result.Editor;
}

