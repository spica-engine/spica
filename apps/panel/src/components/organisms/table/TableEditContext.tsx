import React from "react";

export type CellEditPayload = {
  handleCellSave: (value: any, columnId: string, rowId: string) => Promise<any>;
};

export type RegisterCellPayload = {
  saveFn: () => Promise<any>;
  discardFn?: () => void;
  columnId: string;
  rowId: string;
};

export type TableEditContextType = {
  handleCellSave: (value: any, columnId: string, rowId: string) => Promise<any>;
  registerActiveCell: (payload: RegisterCellPayload) => void;
  unregisterActiveCell: () => void;
};

export const TableEditContext = React.createContext<TableEditContextType>({
  handleCellSave: () => Promise.resolve(),
  registerActiveCell: () => {},
  unregisterActiveCell: () => {}
});
