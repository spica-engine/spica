import React, {memo, useState, useCallback, useEffect, useMemo} from "react";
import styles from "./BucketActionBar.module.scss";
import {Button, FlexElement, Icon, Popover, Checkbox} from "oziko-ui-kit";
import SearchBar from "../../../components/atoms/search-bar/SearchBar";
import debounce from "lodash/debounce";
import BucketMorePopup from "../bucket-more-popup/BucketMorePopup";
import Confirmation from "../confirmation/Confirmation";
import type {BucketDataType, BucketType, Property} from "src/services/bucketService";
import type {ColumnType} from "../../../components/organisms/bucket-table/BucketTable";
import BucketEntryDrawer from "../../organisms/BucketEntryDrawer/BucketEntryDrawer";
import {useEntrySelection} from "../../../hooks/useEntrySelection";

type BucketActionBarProps = {
  onRefresh: () => Promise<BucketDataType | void>;
  onSearch: (search: string) => void;
  bucket: BucketType;
  bucketData: Record<string, any>[];
  searchLoading?: boolean;
  refreshLoading?: boolean;
  columns: ColumnType[];
  visibleColumns: Record<string, boolean>;
  toggleColumn: (key?: string) => void;
  deleteBucketEntries: (
    entryIds: string[],
    bucketId: string
  ) => Promise<{failed: string[]; succeeded: string[]}>;
};

const SEARCH_DEBOUNCE_TIME = 1000;

const generateErrorMessage = (failedIds: string[]): string | null => {
  const count = failedIds.length;
  if (count === 0) return null;
  if (count === 1) {
    return `Failed to delete the entry with id ${failedIds[0]}.`;
  }
  if (count === 2) {
    return `Failed to delete the entries with ids ${failedIds[0]} and ${failedIds[1]}.`;
  }
  return `Failed to delete the entries with ids ${failedIds[0]}, ${failedIds[1]}, and ${count - 2} more.`;
};

const DeleteWarningParagraph = ({
  selectedEntries,
  dependentRelations,
  bucketData
}: {
  selectedEntries: Set<string>;
  dependentRelations: Property[];
  bucketData: Record<string, any>[];
}) => {
  const count = selectedEntries.size;
  const isSingle = count === 1;

  console.log({dependentRelations, bucketData, selectedEntries});
  const relationTitles = dependentRelations.map(relation => relation.title);
  const dependentEntries =
    dependentRelations.length > 0 ? bucketData.filter(entry => selectedEntries.has(entry._id)) : [];

  const relatedIds = dependentEntries.flatMap(entry => {
    return relationTitles.flatMap(title => {
      const fieldValue = entry[title];
      const relationBucketId = dependentRelations.find(r => r.title === title)?.bucketId;
      if (Array.isArray(fieldValue)) {
        return fieldValue.map(item => `${relationBucketId}/${item._id}`);
      }

      return `${relationBucketId}/${fieldValue?._id}` || [];
    });
  });

  const uniqueRelatedIds = [...new Set(relatedIds)];
  const dependentCount = uniqueRelatedIds.length;

  return (
    <div className="space-y-2">
      <p>
        This action will permanently delete {count} selected entr
        {isSingle ? "y" : "ies"}.
      </p>

      {dependentEntries.length > 0 && (
        <div>
          <p>
            Break all relations and delete {dependentCount} dependent document
            {dependentCount === 1 ? "" : "s"}:
          </p>
          <ul>
            {uniqueRelatedIds.map(entryId => (
              <li key={entryId}>{entryId}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const BucketActionBar = ({
  onRefresh,
  onSearch,
  bucket,
  bucketData,
  searchLoading,
  refreshLoading,
  columns,
  visibleColumns,
  toggleColumn,
  deleteBucketEntries
}: BucketActionBarProps) => {
  const [searchValue, setSearchValue] = useState("");
  const {selectedEntries, deselectEntry} = useEntrySelection(bucket._id);

  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteEntryError, setDeleteEntryError] = useState<string | null>(null);

  useEffect(() => setSearchValue(""), [bucket?._id]);

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

  const dependentRelations = useMemo(
    () =>
      Object.values(bucket?.properties).filter(prop => prop.type === "relation" && prop.dependent),
    [bucket]
  );

  const handleEntryDeletion = async () => {
    setDeleteLoading(true);
    setDeleteEntryError(null);
    try {
      const entryIds = Array.from(selectedEntries);
      const {failed: failedEntryIds, succeeded: deletedEntryIds} = await deleteBucketEntries(entryIds, bucket._id);

      deletedEntryIds.forEach(id => deselectEntry(id));
      await onRefresh();

      const message = generateErrorMessage(failedEntryIds);
      if (message) {
        setDeleteEntryError(message);
      } else {
        setIsDeleteConfirmationOpen(false);
      }
    } catch (error) {
      console.error("Failed to delete entries:", error);
      setDeleteEntryError("An unexpected error occurred while deleting entries. Please try again.");
    } finally {
      setDeleteLoading(false);
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

  const {allColumnsVisible, someColumnsVisible} = useMemo(() => {
    const {_id, ...otherColumnsVisibility} = visibleColumns;
    const otherColumnsValues = Object.values(otherColumnsVisibility);
    const allColumnsVisible = otherColumnsValues.every(isVisible => isVisible);
    const someColumnsVisible =
      !allColumnsVisible && otherColumnsValues.some(isVisible => isVisible);
    return {allColumnsVisible, someColumnsVisible};
  }, [visibleColumns]);

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
        <BucketEntryDrawer bucket={bucket} />
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
                checked={allColumnsVisible}
                indeterminate={someColumnsVisible}
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
              <DeleteWarningParagraph
                selectedEntries={selectedEntries}
                dependentRelations={dependentRelations}
                bucketData={bucketData}
              />
              <span>
                Please type <strong>agree</strong> to confirm deletion.
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
          confirmCondition={value => value === "agree"}
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
