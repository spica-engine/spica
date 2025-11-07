
import {FlexElement, FluidContainer, Icon, Button} from "oziko-ui-kit";
import SearchBar from "../../../../components/atoms/search-bar/SearchBar";
import styles from "./StorageActionBar.module.scss";

import CreateFolder from "../create-folder-modal/CreateFolderModal";
import {ROOT_PATH} from "../../constants";
import CreateFile from "../create-file-modal/CreateFile";
import { useAppSelector } from "../../../../store/hook";
import { selectDirectory, selectCurrentDirectory } from "../../../../store";

export default function StorageActionBar() {
  const directory = useAppSelector(selectDirectory);
  const currentDirectory = useAppSelector(selectCurrentDirectory);
  
  const visibleDirectories = directory
    .filter(dir => dir.currentDepth)
    .sort((a, b) => (a.currentDepth || 0) - (b.currentDepth || 0));
  
  const currentItemNames = visibleDirectories
    .flatMap(dir => dir.items?.map(item => item.name).filter(Boolean) || [])

  const prefix =
    !currentDirectory || currentDirectory === ROOT_PATH
      ? ""
      : currentDirectory.split("/").filter(Boolean).join("/") + "/";

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
