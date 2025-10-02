import {
  FlexElement,
  FluidContainer,
  InputWithIcon,
  Icon,
  Popover,
  Button,
  Text,
  Directory
} from "oziko-ui-kit";
import {type FC, memo} from "react";
import styles from "./StorageModalHeading.module.scss";
import StorageFilter from "../../../molecules/storage-filter/StorageFilter";
import SortPopoverContent, {type TypeSortProp} from "../sort-popover-content/SortPopoverContent";

type TypeFilterValue = {
  type: string[];
  fileSize: {
    min: {
      value: number | null;
      unit: string;
    };
    max: {
      value: number | null;
      unit: string;
    };
  };
  quickdate: string | null;
  dateRange: {
    from: null | string;
    to: null | string;
  };
};

type TypeStorageModalHeading = {
  directory: string[];
  fileLength?: number;
  folderLength?: number;
  onChangeSearch?: (search: string) => void;
  onClickSort?: (prop: TypeSortProp) => void;
  onChangeDirectory?: (index: number) => void;
  onApplyFilter?: (filter: TypeFilterValue) => void;
  onCancelFilter?: () => void;
  onClearFilter?: () => void;
  hasActiveFilter?: boolean;
};

const StorageModalHeading: FC<TypeStorageModalHeading> = ({
  directory,
  fileLength = 0,
  folderLength = 0,
  onClickSort,
  onChangeDirectory,
  onChangeSearch,
  onApplyFilter,
  onCancelFilter,
  onClearFilter,
  hasActiveFilter = false
}) => {
  const handleClickSortProp = (prop: TypeSortProp) => {
    onClickSort?.(prop);
  };

  return (
    <FlexElement dimensionX="fill" direction="vertical" gap={20} className={styles.container}>
      <FluidContainer
        dimensionX="fill"
        prefix={{
          children: <Directory directory={directory} onChangeDirectory={onChangeDirectory} />
        }}
        root={{
          dimensionX: "fill",
          alignment: "rightCenter",
          children: (
            <FlexElement gap={10}>
              {!!folderLength && <Text>{folderLength} Folder</Text>}
              {!!fileLength && <Text>{fileLength} File</Text>}
            </FlexElement>
          )
        }}
      />
      <FluidContainer
        dimensionX="fill"
        prefix={{
          children: (
            <InputWithIcon
              dimensionX={400}
              className={styles.inputContainer}
              prefix={{
                children: <Icon name="magnify" />
              }}
              inputProps={{
                placeholder: "Search",
                className: `${styles.input}`,
                onChange: e => onChangeSearch?.(e.target.value)
              }}
            />
          )
        }}
        root={{
          dimensionX: "fill",
          alignment: "rightCenter",
          children: (
            <FlexElement gap={10}>
              {hasActiveFilter && (
                <Button variant="text" onClick={onClearFilter}>
                  <Icon name="close" />
                  Clear Filter
                </Button>
              )}
              <Popover 
                content={
                  <StorageFilter 
                    onApply={onApplyFilter} 
                    onCancel={onCancelFilter} 
                  />
                } 
                placement="bottomEnd" 
                trigger="click"
              >
                <Button variant="text" color={hasActiveFilter ? "primary" : undefined}>
                  <Icon name="filter" size="sm"/>
                  Filter
                  {hasActiveFilter && <Icon name="check" />}
                </Button>
              </Popover>
              <Popover
                content={<SortPopoverContent onClick={handleClickSortProp} />}
                placement="bottomEnd"
                trigger="click"
              >
                <Button variant="text">
                  <Icon name="sort"  size="sm"/>
                  Sort
                </Button>
              </Popover>
            </FlexElement>
          )
        }}
      />
    </FlexElement>
  );
};

export default memo(StorageModalHeading);
