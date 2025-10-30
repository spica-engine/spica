import {FlexElement, FluidContainer, Icon, Button, CircularProgress} from "oziko-ui-kit";
import SearchBar from "../../../../components/atoms/search-bar/SearchBar";
import styles from "./StorageActionBar.module.scss";
import CreateFile from "src/components/molecules/create-file-modal/CreateFile";
import type {TypeDirectories} from "../../../../types/storage";
import {findMaxDepthDirectory} from "../../utils";
import {ROOT_PATH} from "../../constants";
interface StorageActionBarProps {
  directory: TypeDirectories;
}

export default function StorageActionBar({directory}: StorageActionBarProps) {
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
              {({onOpen, loading, progress}) => (
                <Button
                  className={`${styles.actionBarButton} ${styles.uploadFileButton}`}
                  variant="filled"
                  onClick={onOpen}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <CircularProgress
                        strokeWidth={3}
                        size="xxs"
                        percent={progress}
                        status={progress === 100 ? "success" : "normal"}
                        label={progress === 100 ? undefined : null}
                      />
                      Loading..
                    </>
                  ) : (
                    <>
                      <Icon name="plus" />
                      Upload Files
                    </>
                  )}
                </Button>
              )}
            </CreateFile>
            <Button className={styles.actionBarButton} variant="filled">
              <Icon name="plus" />
              Create New Folder
            </Button>
          </FlexElement>
        )
      }}
    />
  );
}
