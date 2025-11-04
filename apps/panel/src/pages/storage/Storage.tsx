import {FluidContainer} from "oziko-ui-kit";
import styles from "./Storage.module.scss";
import {StorageItemColumns} from "./components/storage-columns/StorageColumns";
import StorageActionBar from "./components/storage-action-bar/StorageActionBar";

export default function StoragePage() {

  return (
    <div className={styles.container}>
      <StorageActionBar />
      <FluidContainer
        gap={0}
        className={styles.storageItemContainer}
        root={{
          className: styles.storageItemColumns,
          children: <StorageItemColumns />
        }} 
      />
    </div>
  );
}
