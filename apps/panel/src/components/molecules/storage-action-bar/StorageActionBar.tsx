import {FlexElement, FluidContainer, Icon, Button, Popover} from "oziko-ui-kit";
import SearchBar from "../../atoms/search-bar/SearchBar";
import styles from "./StorageActionBar.module.scss";
import CreateFile from "../create-file-modal/CreateFile";
import CreateFolder from "../create-folder-modal/CreateFolderModal";
import type {TypeDirectories} from "src/components/organisms/storage-columns/StorageColumns";
import {findMaxDepthDirectory, ROOT_PATH} from "../../../pages/storage/StorageHooks";

interface StorageActionBarProps {
  directory: TypeDirectories;
}

export default function StorageActionBar({directory}: StorageActionBarProps) {
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
            <CreateFile prefix={prefix}>
              {({onOpen}) => (
                <Button className={styles.actionBarButton} variant="filled" onClick={onOpen}>
                  <Icon name="plus" />
                  Upload Files
                </Button>
              )}
            </CreateFile>
            <CreateFolder prefix={prefix} forbiddenNames={currentItemNames}>
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
