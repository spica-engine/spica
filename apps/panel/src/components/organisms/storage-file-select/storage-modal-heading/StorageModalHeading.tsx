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

type TypeStorageModalHeading = {
  directory: string[];
  fileLength?: number;
  folderLength?: number;
  onChangeSearch?: (search: string) => void;
  onClickSort?: (prop: TypeSortProp) => void;
  onChangeDirectory?: (index: number) => void;
};

const StorageModalHeading: FC<TypeStorageModalHeading> = ({
  directory,
  fileLength = 0,
  folderLength = 0,
  onClickSort,
  onChangeDirectory,
  onChangeSearch
}) => {
  const handleClickSortProp = (prop: TypeSortProp) => {
    onClickSort?.(prop);
  };

  return (
    <FlexElement dimensionX="fill" direction="vertical" gap={20}>
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
              <Popover content={<StorageFilter />} placement="bottomEnd" trigger="click">
                <Button variant="text">
                  <Icon name="filter" />
                  Filter
                </Button>
              </Popover>
              <Popover
                content={<SortPopoverContent onClick={handleClickSortProp} />}
                placement="bottomEnd"
                trigger="click"
              >
                <Button variant="text">
                  <Icon name="sort" />
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
