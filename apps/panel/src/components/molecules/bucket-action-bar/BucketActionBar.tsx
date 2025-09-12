import React, {memo, useState, useCallback, useEffect, useMemo} from "react";
import styles from "./BucketActionBar.module.scss";
import {Button, FlexElement, Icon, Popover, Checkbox} from "oziko-ui-kit";
import SearchBar from "../../../components/atoms/search-bar/SearchBar";
import debounce from "lodash/debounce";
import BucketMorePopup from "../bucket-more-popup/BucketMorePopup";
import Confirmation from "../confirmation/Confirmation";
import type {BucketDataType, BucketType} from "src/services/bucketService";
import type {ColumnType} from "../../../components/organisms/bucket-table/BucketTable";
import {useEntrySelection} from "../../../contexts/EntrySelectionContext";

type BucketActionBarProps = {
  onRefresh: () => Promise<any>;
  onSearch: (search: string) => void;
  bucket: BucketType;
  searchLoading?: boolean;
  refreshLoading?: boolean;
  columns: ColumnType[];
  visibleColumns: Record<string, boolean>;
  toggleColumn: (key?: string) => void;
  deleteBucketEntry: (entryId: string, bucketId: string) => Promise<any>;
};

const SEARCH_DEBOUNCE_TIME = 1000;

const BucketActionBar = ({
  onRefresh,
  onSearch,
  bucket,
  searchLoading,
  refreshLoading,
  columns,
  visibleColumns,
  toggleColumn,
  deleteBucketEntry
}: BucketActionBarProps) => {
  const [searchValue, setSearchValue] = useState("");
  const {selectedEntries, deselectEntry} = useEntrySelection();

  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteEntryError, setDeleteEntryError] = useState<string | null>(null);

  useEffect(() => setSearchValue(""), [bucket?._id]);
  const isReadOnlyChecked = useMemo(() => bucket?.readOnly, [bucket]);

  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        onSearch(value);
      }, SEARCH_DEBOUNCE_TIME),
    [onSearch]
  );

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trimStart();
    setSearchValue(value);
  };

  useEffect(() => {
    debouncedSearch(searchValue);
  }, [searchValue]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        debouncedSearch.flush();
      }
    },
    [debouncedSearch]
  );

  const handleEntryDeletion = async () => {
    setDeleteLoading(true);
    setDeleteEntryError(null);
    const failedEntryIds: string[] = [];
    await Promise.all(
      Array.from(selectedEntries).map(async entryId => {
        const result: string | null = await deleteBucketEntry(entryId, bucket._id);
        console.log("Deletion result for entryId", entryId, ":", result);
        if (!result) {
          failedEntryIds.push(entryId);
        }
      })
    );

    const newBucketData = (await onRefresh()) as BucketDataType;
    if (newBucketData) {
      setTimeout(() => {
        const dataIds = new Set(newBucketData?.data.map(d => d._id));
        const deletedIds = [...selectedEntries].filter(id => !dataIds.has(id));
        deletedIds.forEach(id => deselectEntry(id));
      }, 0);
    }
    setDeleteLoading(false);
    if (failedEntryIds.length > 0) {
      let message = "";
      if (failedEntryIds.length === 1) {
        message = `Failed to delete the entry with id ${failedEntryIds[0]}.`;
      } else if (failedEntryIds.length === 2) {
        message = `Failed to delete the entries with ids ${failedEntryIds[0]} and ${failedEntryIds[1]}.`;
      } else {
        message = `Failed to delete the entries with ids ${failedEntryIds[0]}, ${failedEntryIds[1]}, and ${failedEntryIds.length - 2} more.`;
      }
      setDeleteEntryError(message);
    } else {
      setIsDeleteConfirmationOpen(false);
    }
  };

  const handleCloseEntryDeletionForm = () => {
    setDeleteEntryError(null);
    setIsDeleteConfirmationOpen(false);
  };

  const handleOpenEntryDeletionForm = () => {
    setDeleteEntryError(null);
    setIsDeleteConfirmationOpen(true);
  };

  return (
    <div className={styles.container}>
      <SearchBar
        inputProps={{
          onKeyDown: handleKeyDown,
          value: searchValue,
          onChange: handleSearchInputChange
        }}
        loading={searchLoading}
      />
      <FlexElement className={styles.actionBar}>
        {selectedEntries.size > 0 && (
          <Button
            onClick={handleOpenEntryDeletionForm}
            color="danger"
            className={styles.deleteButton}
          >
            <Icon name="delete" />
            Delete
          </Button>
        )}
        {!isReadOnlyChecked && (
          <Button onClick={() => {}}>
            <Icon name="plus" />
            New Entry
          </Button>
        )}
        <Button
          className={styles.refreshButton}
          variant="text"
          onClick={onRefresh}
          disabled={refreshLoading || searchLoading}
          loading={refreshLoading}
        >
          <Icon name="refresh" />
          Refresh
        </Button>
        <Popover
          contentProps={{
            className: styles.columnsPopoverContent
          }}
          content={
            <div>
              <Checkbox
                label="Display All"
                checked={Object.values(visibleColumns).every(v => v)}
                onChange={() => toggleColumn()}
                className={styles.displayAllCheckbox}
              />
              {columns.slice(1).map(col => (
                <Checkbox
                  key={col.key}
                  label={col.header}
                  checked={visibleColumns[col.key]}
                  onChange={() => toggleColumn(col.key)}
                />
              ))}
            </div>
          }
        >
          <Button className={styles.columnButton} variant="text" onClick={() => {}}>
            <Icon name="eye" />
            Column
          </Button>
        </Popover>
        <BucketMorePopup bucket={bucket} />
      </FlexElement>
      {isDeleteConfirmationOpen && (
        <Confirmation
          title="DELETE ENTRIES"
          inputPlaceholder="Type Here"
          description={
            <>
              <p>
                This action will permanently delete {selectedEntries.size} selected entr
                {selectedEntries.size === 1 ? "y" : "ies"}.
              </p>
              <span>
                Please type <strong>Agree</strong> to confirm deletion.
              </span>
            </>
          }
          confirmLabel={
            <>
              <Icon name="delete" />
              Delete
            </>
          }
          cancelLabel={
            <>
              <Icon name="close" />
              Cancel
            </>
          }
          confirmCondition={value => value === "Agree"}
          loading={deleteLoading}
          error={deleteEntryError}
          onConfirm={handleEntryDeletion}
          onCancel={handleCloseEntryDeletionForm}
        />
      )}
    </div>
  );
};

export default memo(BucketActionBar);
