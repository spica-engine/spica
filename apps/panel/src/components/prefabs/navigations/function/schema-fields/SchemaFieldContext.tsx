import {createContext, useContext} from "react";
import type {RenderFieldFn, ArrayCallbacks, SchemaFieldStyles} from "./types";

type SchemaFieldContextValue = {
  renderField: RenderFieldFn;
  styles: SchemaFieldStyles;
} & ArrayCallbacks;

const SchemaFieldContext = createContext<SchemaFieldContextValue | null>(null);

export const SchemaFieldProvider = SchemaFieldContext.Provider;

export function useSchemaFieldContext(): SchemaFieldContextValue {
  const ctx = useContext(SchemaFieldContext);
  if (!ctx) throw new Error("useSchemaFieldContext must be used within SchemaFieldProvider");
  return ctx;
}
