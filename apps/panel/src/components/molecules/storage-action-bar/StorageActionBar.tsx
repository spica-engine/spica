import {useState} from "react";
import {FlexElement, FluidContainer, Icon, Button, Popover} from "oziko-ui-kit";
import SearchBar from "../../atoms/search-bar/SearchBar";
import StorageFilter from "../storage-filter/StorageFilter";
import styles from "./StorageActionBar.module.scss";

interface StorageActionBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onApplyFilter: (filter: any) => void;
  onSort?: () => void;
  onRefresh?: () => void;
  onUploadFiles?: () => void;
  onCreateFolder?: () => void;
}

export default function StorageActionBar({
  searchQuery,
  onSearchChange,
  onApplyFilter,
  onSort,
  onRefresh,
  onUploadFiles,
  onCreateFolder
}: StorageActionBarProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value);
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

  return (
    <FluidContainer
      className={styles.actionBar}
      prefix={{
        children: (
          <FlexElement gap={8}>
            <SearchBar
              inputProps={{
                value: searchQuery,
                onChange: handleSearchChange
              }}
            />
            <Popover
              open={isFilterOpen}
              onClose={handleOnFilterClose}
              content={<StorageFilter onApply={handleApplyFilter} onCancel={handleCancelFilter} />}
            >
              <Button className={styles.actionBarButton} variant={"filled"} onClick={handleOpenFilter}>
                <Icon name="filter" />
                Filter
              </Button>
            </Popover>
          </FlexElement>
        )
      }}
      suffix={{
        children: (
          <FlexElement>
            <Button className={styles.actionBarButton} variant="filled" onClick={onSort}>
              <Icon name="sort" />
              Sort
            </Button>
            <Button className={styles.actionBarButton} variant="filled" onClick={onRefresh}>
              <Icon name="refresh" />
              Refresh
            </Button>
            <Button className={styles.actionBarButton} variant="filled" onClick={onUploadFiles}>
              <Icon name="plus" />
              Upload Files
            </Button>
            <Button className={styles.actionBarButton} variant="filled" onClick={onCreateFolder}>
              <Icon name="plus" />
              Create New Folder
            </Button>
          </FlexElement>
        )
      }}
    />
  );
}
