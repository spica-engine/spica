/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React from "react";
import {useNavigate} from "react-router-dom";
import {handleFolderClick} from "../../../store";
import {useAppDispatch} from "../../../store/hook";
import {ROOT_PATH} from "../../../pages/storage/constants";
import styles from "./StorageNavigation.module.scss";
import { Icon, Text } from "oziko-ui-kit";
import type { NavigationPrefabProps } from "../navigation-registry";

const StorageNavigation: React.FC<NavigationPrefabProps> = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const handleRootClick = () => {
    navigate("/storage");
    dispatch(
      handleFolderClick({
        folderName: "",
        fullPath: ROOT_PATH,
        directoryDepth: 1,
        wasActive: true,
        isFilteringOrSearching: false
      })
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Text size="large">Storage</Text>
      </div>
      <div onClick={handleRootClick} className={styles.rootItem}>
        <Icon name="folder" className={styles.rootItemIcon}/>
        <Text size="small">/</Text>
      </div>
    </div>
  );
};

export default StorageNavigation;
