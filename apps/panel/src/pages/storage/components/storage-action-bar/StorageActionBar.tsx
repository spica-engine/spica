import {FlexElement, FluidContainer, Icon, Button, Popover} from "oziko-ui-kit";
import SearchBar from "../../../../components/atoms/search-bar/SearchBar";
import styles from "./StorageActionBar.module.scss";

import CreateFolder from "../create-folder-modal/CreateFolderModal";
import type {TypeDirectories} from "src/types/storage";
import {findMaxDepthDirectory} from "../../utils";
import {ROOT_PATH} from "../../constants";
import CreateFile from "../create-file-modal/CreateFile";
import { useDirectoryNavigation } from "../../hooks/useDirectoryNavigation";


export default function StorageActionBar() {
  const {directory} = useDirectoryNavigation();
  
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
            <CreateFile prefix={prefix} className={styles.actionBarButton}/>
            <CreateFolder prefix={prefix} forbiddenNames={currentItemNames} buttonClassName={styles.actionBarButton}/>
          </FlexElement>
        )
      }}
    />
  );
}
