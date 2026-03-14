import {useCallback, useMemo} from "react";
import {useAppDispatch, useAppSelector} from "../store/hook";
import {
  selectEntry,
  selectEntries,
  deselectEntry,
  deselectEntries,
  resetBucketSelection,
  selectSelectedEntryIds
} from "../store";

export const useEntrySelection = (bucketId: string) => {
  const dispatch = useAppDispatch();
  const selectedEntryIds = useAppSelector(state => selectSelectedEntryIds(state, bucketId));

  const selectedEntries = useMemo(() => new Set(selectedEntryIds), [selectedEntryIds]);

  const handleSelectEntry = useCallback(
    (entryId: string) => {
      dispatch(selectEntry({bucketId, entryId}));
    },
    [dispatch, bucketId]
  );

  const handleSelectEntries = useCallback(
    (entryIds: string[]) => {
      dispatch(selectEntries({bucketId, entryIds}));
    },
    [dispatch, bucketId]
  );

  const handleDeselectEntry = useCallback(
    (entryId: string) => {
      dispatch(deselectEntry({bucketId, entryId}));
    },
    [dispatch, bucketId]
  );

  const handleDeselectEntries = useCallback(
    (entryIds: string[]) => {
      dispatch(deselectEntries({bucketId, entryIds}));
    },
    [dispatch, bucketId]
  );

  const handleResetSelection = useCallback(() => {
    dispatch(resetBucketSelection(bucketId));
  }, [dispatch, bucketId]);

  return {
    selectedEntries,
    selectEntry: handleSelectEntry,
    selectEntries: handleSelectEntries,
    deselectEntry: handleDeselectEntry,
    deselectEntries: handleDeselectEntries,
    resetSelection: handleResetSelection
  };
};

