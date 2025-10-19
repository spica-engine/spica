import {FlexElement, FluidContainer, Icon, Button, Popover} from "oziko-ui-kit";
import SearchBar from "../../atoms/search-bar/SearchBar";
import styles from "./StorageActionBar.module.scss";
import CreateFile from "../create-file-modal/CreateFile";
import CreateFolder from "../create-folder-modal/CreateFolderModal";
import type {TypeDirectories} from "src/components/organisms/storage-columns/StorageColumn";
import { ROOT_PATH } from "src/pages/storage/StorageHooks";

interface StorageActionBarProps {
  directory: TypeDirectories;
}

export default function StorageActionBar({directory}: StorageActionBarProps) {
  const visibleDirectories = directory.filter(dir => dir.currentDepth);
  const currentPrefix = visibleDirectories
    .filter(i => i.fullPath !== ROOT_PATH)
    .map(i => i.label)
    .join("");
  const currentItemNames = visibleDirectories
    .map(dir => dir.items?.map(item => item.name).filter(Boolean) || [])
    .flat();

  return (
    <FluidContainer
      className={styles.actionBar}
      prefix={{
        children: <SearchBar />
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
            <CreateFile prefix={currentPrefix}>
              {({onOpen}) => (
                <Button className={styles.actionBarButton} variant="filled" onClick={onOpen}>
                  <Icon name="plus" />
                  Upload Files
                </Button>
              )}
            </CreateFile>
            <CreateFolder prefix={currentPrefix} currentItemNames={currentItemNames}>
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
