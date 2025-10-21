import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
  useEffect
} from "react";

interface EntrySelectionContextType {
  selectedEntries: Set<string>;
  selectEntry: (entryId: string) => void;
  deselectEntry: (entryId: string) => void;
}

const EntrySelectionContext = createContext<EntrySelectionContextType | undefined>(undefined);

interface EntrySelectionProviderProps {
  children: ReactNode;
  currentBucketId: string;
}

export const EntrySelectionProvider: React.FC<EntrySelectionProviderProps> = ({
  children,
  currentBucketId
}) => {
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());

  const selectEntry = useCallback((entryId: string) => {
    setSelectedEntries(prev => new Set(prev).add(entryId));
  }, []);

  const deselectEntry = useCallback((entryId: string) => {
    setSelectedEntries(prev => {
      const newSet = new Set(prev);
      newSet.delete(entryId);
      return newSet;
    });
  }, []);

  const value = {
    selectedEntries,
    selectEntry,
    deselectEntry
  };

  useEffect(() => {
    setSelectedEntries(new Set());
  }, [currentBucketId]);

  return <EntrySelectionContext value={value}>{children}</EntrySelectionContext>;
};

export const useEntrySelection = () => {
  const context = useContext(EntrySelectionContext);
  if (context === undefined) {
    throw new Error("useEntrySelection must be used within a EntrySelectionProvider");
  }
  return context;
};
