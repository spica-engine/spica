import React from "react";
import type { FieldKind } from "src/domain/fields";
import type { Constraints } from "./types";

export type CellEditPayload = {
  ref: React.RefObject<HTMLElement | null>;
  value: any;
  type: FieldKind;
  title: string;
  constraints?: Constraints;
  columnId: string;
  rowId: string;
  setCellValue: (value: any) => void;
};

export type TableEditContextType = {
  onEditCellStart: (payload: CellEditPayload) => void;
};

export const TableEditContext = React.createContext<TableEditContextType>({
  onEditCellStart: () => {},
});