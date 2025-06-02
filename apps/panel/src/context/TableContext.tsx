import React, {createContext, useContext, useState, useCallback} from "react";
import type {TypeColumn} from "oziko-ui-kit";

type TableContextType = {
  columnsMap: Record<string, TypeColumn[]>;
  setBucketColumns: (bucketId: string, columns: TypeColumn[]) => void;
};

const TableContext = createContext<TableContextType | undefined>(undefined);

export const TableProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [columnsMap, setColumnsMap] = useState<Record<string, TypeColumn[]>>({});

  const setBucketColumns = useCallback((bucketId: string, columns: TypeColumn[]) => {
    setColumnsMap(prev => ({...prev, [bucketId]: columns}));
  }, []);

  return (
    <TableContext.Provider value={{columnsMap, setBucketColumns}}>{children}</TableContext.Provider>
  );
};

export const useTableContext = () => {
  const context = useContext(TableContext);
  if (!context) {
    throw new Error("useTableContext must be used within a TableProvider");
  }
  return context;
};
