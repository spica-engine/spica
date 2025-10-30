import React from "react";
import {FlexElement, FluidContainer, Icon, Button} from "oziko-ui-kit";
import SearchBar from "../../../../components/atoms/search-bar/SearchBar";
import styles from "./StorageActionBar.module.scss";
import CreateFile from "../../../../components/molecules/create-file-modal/CreateFile";
import type {TypeDirectories} from "../../../../types/storage";
import {findMaxDepthDirectory} from "../../utils";
import {ROOT_PATH} from "../../constants";
import { UploadFilesButton } from "./components/UploadFilesButton";

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
              {({onOpen, loading, progress, error}) => (
                <UploadFilesButton
                  onOpen={onOpen}
                  loading={loading}
                  progress={progress}
                  className={`${styles.actionBarButton} ${styles.uploadFileButton}`}
                  error={error}
                />
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
