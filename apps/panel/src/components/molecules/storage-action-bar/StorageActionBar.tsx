import {useState, useMemo, useEffect} from "react";
import {
  FlexElement,
  FluidContainer,
  Icon,
  Button,
  Popover,
  type TypeFilterValue
} from "oziko-ui-kit";
import SearchBar from "../../atoms/search-bar/SearchBar";
import StorageFilter from "../storage-filter/StorageFilter";
import styles from "./StorageActionBar.module.scss";
import CreateFile from "../create-file-modal/CreateFile";
import CreateFolder from "../create-folder-modal/CreateFolderModal";
import type {TypeDirectories} from "src/components/organisms/storage-columns/StorageColumns";
import {findMaxDepthDirectory, ROOT_PATH} from "../../../pages/storage/StorageHooks";
import debounce from "lodash/debounce";

interface StorageActionBarProps {
  onSearchChange: (value: string) => void;
  onApplyFilter: (filter: any) => void;
  directory: TypeDirectories;
  currentFilter?: TypeFilterValue;
  isLoading?: boolean;
}

const SEARCH_DEBOUNCE_TIME = 1000;

export default function StorageActionBar({
  onSearchChange,
  onApplyFilter,
  directory,
  currentFilter,
  isLoading
}: StorageActionBarProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        onSearchChange(value);
      }, SEARCH_DEBOUNCE_TIME),
    [onSearchChange]
  );

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trimStart();
    setSearchValue(value);
  };

  useEffect(() => {
    debouncedSearch(searchValue);
  }, [searchValue, debouncedSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      debouncedSearch.flush();
    }
  };

  const handleOpenFilter = () => setIsFilterOpen(true);

  const handleCancelFilter = () => {
    setIsFilterOpen(false);
  };

  const handleApplyFilter = (filter: any) => {
    onApplyFilter(filter);
    setIsFilterOpen(false);
  };

  const handleOnFilterClose = () => {
    setIsFilterOpen(false);
  };

  const handleClearFilter = () => {
    onApplyFilter(null);
  };

  const visibleDirectories = directory.filter(dir => dir.currentDepth);
  const currentItemNames = visibleDirectories
    .map(dir => dir.items?.map(item => item.name).filter(Boolean) || [])
    .flat();

  const deepestPath = findMaxDepthDirectory(directory)?.fullPath;
  const prefix =
    !deepestPath || deepestPath === ROOT_PATH
      ? ""
      : deepestPath.split("/").filter(Boolean).join("/") + "/";

  return (
    <FluidContainer
      className={styles.actionBar}
      prefix={{
        children: (
          <FlexElement gap={8}>
            <SearchBar
              inputProps={{
                onKeyDown: handleKeyDown,
                value: searchValue,
                onChange: handleSearchChange
              }}
              loading={isLoading}
            />
            <Popover
              open={isFilterOpen}
              onClose={handleOnFilterClose}
              content={
                <StorageFilter
                  currentFilter={currentFilter}
                  onApply={handleApplyFilter}
                  onCancel={handleCancelFilter}
                />
              }
            >
              <Button
                className={`${currentFilter ? "" : styles.actionBarButton} ${styles.filterButton}`}
                variant={currentFilter ? undefined : "filled"}
                onClick={handleOpenFilter}
              >
                <Icon name="filter" />
                Filter
              </Button>
              {currentFilter && (
                <Button
                  className={styles.actionBarButton}
                  variant={"filled"}
                  onClick={handleClearFilter}
                >
                  <Icon name="close" />
                  Clear Filters
                </Button>
              )}
            </Popover>
          </FlexElement>
        )
      }}
      suffix={{
        children: (
          <FlexElement>
            <Button className={styles.actionBarButton} variant="filled">
              <Icon name="sort" />
              Sort
            </Button>
            <Button className={styles.actionBarButton} variant="filled">
              <Icon name="refresh" />
              Refresh
            </Button>
            <CreateFile prefix={prefix}>
              {({onOpen}) => (
                <Button className={styles.actionBarButton} variant="filled" onClick={onOpen}>
                  <Icon name="plus" />
                  Upload Files
                </Button>
              )}
            </CreateFile>
            <CreateFolder prefix={prefix} currentItemNames={currentItemNames}>
              {({onOpen}) => (
                <Button className={styles.actionBarButton} variant="filled" onClick={onOpen}>
                  <Icon name="plus" />
                  Create New Folder
                </Button>
              )}
            </CreateFolder>
          </FlexElement>
        )
      }}
    />
  );
}
