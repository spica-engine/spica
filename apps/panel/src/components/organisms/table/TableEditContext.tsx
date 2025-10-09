import React from "react";

export type CellEditPayload = {
  onCellSave: (value: any, columnId: string, rowId: string) => Promise<any>;
  isCellEditing: boolean;
};

export type TableEditContextType = {
  onCellSave?: (value: any, columnId: string, rowId: string) => Promise<any>;
  registerActiveCell: () => void;
  unregisterActiveCell: () => void;
};

export const TableEditContext = React.createContext<TableEditContextType>({
  onCellSave: () => Promise.resolve(),
  registerActiveCell: () => {},
  unregisterActiveCell: () => {}
});
