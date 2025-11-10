/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, { useEffect } from "react";
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

  useEffect(() => {
    navigate("/storage");
  }, []);

  const handleRootClick = () => {
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
      <button onClick={handleRootClick} className={styles.rootItem} >
        <Icon name="folder" className={styles.rootItemIcon}/>
        <Text size="small">/</Text>
      </button>
    </div>
  );
};

export default StorageNavigation;
