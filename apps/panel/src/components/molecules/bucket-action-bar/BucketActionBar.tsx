import React, {memo, useState, useCallback, useEffect, useMemo} from "react";
import styles from "./BucketActionBar.module.scss";
import {Button, Icon, Popover} from "oziko-ui-kit";
import SearchBar from "../../../components/atoms/search-bar/SearchBar";
import debounce from "lodash/debounce";
import BucketMorePopup from "../bucket-more-popup/BucketMorePopup";
import Confirmation from "../confirmation/Confirmation";
import type {BucketDataType, BucketType, Property} from "src/store/api/bucketApi";
import type {ColumnType} from "../../../components/organisms/bucket-table/BucketTable";
import BucketEntryDrawer from "../../organisms/BucketEntryDrawer/BucketEntryDrawer";
import BucketIndexManager from "../../organisms/bucket-index-manager/BucketIndexManager";
import {useEntrySelection} from "../../../hooks/useEntrySelection";
import FilterPanel from "../../prefabs/filter-panel/FilterPanel";
import SortPanel from "../../prefabs/sort-panel/SortPanel";
import type {FilterField, FilterConditionRow, SortField} from "../../prefabs/filter-panel/types";
import {isConditionActive, formatConditionValue} from "../../prefabs/filter-panel/filterPanelUtils";

type BucketActionBarProps = {
  onRefresh: () => Promise<BucketDataType | void>;
  onSearch: (search: string) => void;
  /** Active filter conditions, owned by the URL in the parent. */
  appliedConditions: FilterConditionRow[];
  onFilterChange: (conditions: FilterConditionRow[]) => void;
  onSort: (sort: Record<string, 1 | -1> | null) => void;
  filterFields: FilterField[];
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
  appliedConditions,
  onFilterChange,
  onSort,
  filterFields,
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

  const [isColumnsOpen, setIsColumnsOpen] = useState(false);
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteEntryError, setDeleteEntryError] = useState<string | null>(null);
  const [isNewEntryDrawerOpen, setIsNewEntryDrawerOpen] = useState(false);
  const [isIndexManagerOpen, setIsIndexManagerOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  // Bumped on each Filter popover open so FilterPanel remounts and re-seeds its
  // rows from `appliedConditions` regardless of whether the popover keeps its
  // content mounted while closed.
  const [filterHydrationKey, setFilterHydrationKey] = useState(0);
  const [activeSortCount, setActiveSortCount] = useState(0);

  const activeFilterCount = appliedConditions.length;

  const filterFieldMap = useMemo(
    () => new Map(filterFields.map(f => [f.key, f])),
    [filterFields]
  );

  const sortFields: SortField[] = useMemo(
    () => filterFields.map(f => ({key: f.key, label: f.label})),
    [filterFields]
  );

  const handleFilterApply = useCallback(
    (_filter: Record<string, any> | null, conditions: FilterConditionRow[]) => {
      onFilterChange(conditions.filter(isConditionActive));
    },
    [onFilterChange]
  );

  const handleFilterClear = useCallback(() => {
    onFilterChange([]);
  }, [onFilterChange]);

  const handleRemoveFilterChip = useCallback(
    (id: string) => {
      onFilterChange(appliedConditions.filter(c => c.id !== id));
    },
    [appliedConditions, onFilterChange]
  );

  const handleFilterToggle = useCallback(() => {
    setIsFilterOpen(prev => !prev);
    setFilterHydrationKey(k => k + 1);
  }, []);

  const handleSortApply = useCallback(
    (sort: Record<string, 1 | -1> | null) => {
      setActiveSortCount(sort ? Object.keys(sort).length : 0);
      onSort(sort);
    },
    [onSort]
  );

  const handleSortClear = useCallback(() => {
    setActiveSortCount(0);
    onSort(null);
  }, [onSort]);

  // Switching buckets must not carry the previous bucket's search box over. The
  // filter lives in the URL now, so it clears naturally when the route changes.
  useEffect(() => {
    setSearchValue("");
  }, [bucket?._id]);

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

  const {allColumnsVisible, someColumnsVisible, hiddenColumnsCount} = useMemo(() => {
    const {_id, ...otherColumnsVisibility} = visibleColumns;
    const otherColumnsValues = Object.values(otherColumnsVisibility);
    const allColumnsVisible = otherColumnsValues.every(isVisible => isVisible);
    const someColumnsVisible =
      !allColumnsVisible && otherColumnsValues.some(isVisible => isVisible);
    const hiddenColumnsCount = otherColumnsValues.filter(isVisible => !isVisible).length;
    return {allColumnsVisible, someColumnsVisible, hiddenColumnsCount};
  }, [visibleColumns]);

  return (
    <>
    <div className={styles.container}>
        {/* LEFT: search + filter chips */}
        <div className={styles.toolbarLeft}>
          <SearchBar
            className={styles.searchBar}
            inputProps={{
              onKeyDown: handleKeyDown,
              value: searchValue,
              onChange: handleSearchInputChange
            }}
            loading={searchLoading}
          />
          <Button shape="chip" variant="outlined" color="primary">All</Button>
          <Popover
            open={isFilterOpen}
            onClose={() => setIsFilterOpen(false)}
            placement="bottomStart"
            contentProps={{style: {padding: 0, background: 'transparent', boxShadow: 'none', border: 'none'}}}
            content={
              filterFields.length > 0 ? (
                <FilterPanel
                  key={filterHydrationKey}
                  fields={filterFields}
                  initialConditions={appliedConditions}
                  onApply={handleFilterApply}
                  onClear={handleFilterClear}
                  onRequestClose={() => setIsFilterOpen(false)}
                />
              ) : null
            }
          >
            <Button
              shape="chip"
              variant="outlined"
              color="default"
              className={`${(isFilterOpen || activeFilterCount > 0) ? styles.chipActive : ""}`}
              onClick={handleFilterToggle}
            >
              <Icon name="filter" />
              Filter
              {activeFilterCount > 0 && (
                <span className={styles.chipBadge}>{activeFilterCount}</span>
              )}
            </Button>
          </Popover>
          <Popover
            open={isSortOpen}
            onClose={() => setIsSortOpen(false)}
            placement="bottomStart"
            contentProps={{style: {padding: 0, background: 'transparent', boxShadow: 'none', border: 'none'}}}
            content={
              sortFields.length > 0 ? (
                <SortPanel
                  fields={sortFields}
                  onApply={handleSortApply}
                  onClear={handleSortClear}
                />
              ) : null
            }
          >
            <Button
              shape="chip"
              variant="outlined"
              color="default"
              className={`${(isSortOpen || activeSortCount > 0) ? styles.chipActive : ""}`}
              onClick={() => setIsSortOpen(prev => !prev)}
            >
              <Icon name="sort" />
              Sort
              {activeSortCount > 0 && (
                <span className={styles.chipBadge}>{activeSortCount}</span>
              )}
            </Button>
          </Popover>
        </div>

        {/* RIGHT: actions */}
        <div className={styles.toolbarRight}>
          {selectedEntries.size > 0 && (
            <Button
              onClick={handleOpenEntryDeletionForm}
              color="danger"
              variant="outlined"
              className={styles.deleteButton}
            >
              <Icon name="delete" />
              Delete
            </Button>
          )}
          <Button
            className={styles.ghostButton}
            variant="outlined"
            color="default"
            onClick={onRefresh}
            disabled={refreshLoading || searchLoading}
            loading={refreshLoading}
          >
            <Icon name="refresh" />
            Refresh
          </Button>
          <Popover
            open={isColumnsOpen}
            onClose={() => setIsColumnsOpen(false)}
            contentProps={{
              className: styles.columnsPopoverContent
            }}
            content={
              <div className={styles.columnPanel}>
                <div
                  className={styles.displayAllRow}
                  onClick={() => toggleColumn()}
                >
                  <div
                    className={`${styles.customCheckbox} ${
                      allColumnsVisible
                        ? styles.checkboxOn
                        : someColumnsVisible
                        ? styles.checkboxDash
                        : ""
                    }`}
                  >
                    {allColumnsVisible && (
                      <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="3.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                    {!allColumnsVisible && someColumnsVisible && (
                      <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="3.5">
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    )}
                  </div>
                  <span className={styles.displayAllLabel}>Display All</span>
                </div>
                <div className={styles.columnList}>
                  {columns.map(col => {
                    const isVisible = visibleColumns[col.key];
                    const isLocked = col.key === "_id";
                    return (
                      <div
                        key={col.key}
                        className={`${styles.columnRow} ${!isVisible ? styles.columnRowHidden : ""} ${isLocked ? styles.columnRowLocked : ""}`}
                        onClick={!isLocked ? () => toggleColumn(col.key) : undefined}
                      >
                        <div
                          className={`${styles.customCheckbox} ${isVisible ? styles.checkboxOn : ""} ${
                            isLocked ? styles.checkboxDisabled : ""
                          }`}
                        >
                          {isVisible && (
                            <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="3.5">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                        <span className={styles.columnName}>{col.header}</span>
                        {isLocked && <span className={styles.lockedTag}>LOCKED</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            }
          >
            <Button
              className={`${styles.ghostButton} ${isColumnsOpen ? styles.columnButtonActive : ""}`}
              variant="outlined"
              color="default"
              onClick={() => setIsColumnsOpen(prev => !prev)}
            >
              <Icon name="eye" />
              Column
              {hiddenColumnsCount > 0 && (
                <span className={styles.hiddenBadge}>{hiddenColumnsCount}</span>
              )}
            </Button>
          </Popover>
          <BucketMorePopup bucket={bucket} onManageIndexes={() => setIsIndexManagerOpen(true)} />
          <BucketIndexManager
            bucket={bucket}
            isOpen={isIndexManagerOpen}
            onClose={() => setIsIndexManagerOpen(false)}
          />
          <div className={styles.newEntryWrapper}>
            <Button onClick={() => setIsNewEntryDrawerOpen(true)}>
              <Icon name="plus" />
              New Entry
            </Button>
            <BucketEntryDrawer
              bucket={bucket}
              isOpen={isNewEntryDrawerOpen}
              onClose={() => setIsNewEntryDrawerOpen(false)}
              onEntryCreated={onRefresh}
            />
          </div>
        </div>
    </div>

      {appliedConditions.length > 0 && (
        <div className={styles.filterChipsBar}>
          {appliedConditions.map(condition => {
            const field = filterFieldMap.get(condition.field);
            const value = formatConditionValue(condition, field);
            return (
              <div key={condition.id} className={styles.filterChip}>
                <span className={styles.filterChipField}>{field?.label ?? condition.field}</span>
                <span className={styles.filterChipOp}>{condition.operator}</span>
                {value && <span className={styles.filterChipVal}>{value}</span>}
                <button
                  type="button"
                  className={styles.filterChipRemove}
                  aria-label={`Remove ${field?.label ?? condition.field} filter`}
                  onClick={() => handleRemoveFilterChip(condition.id)}
                >
                  <Icon name="close" size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

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
    </>
  );
};

export default memo(BucketActionBar);
