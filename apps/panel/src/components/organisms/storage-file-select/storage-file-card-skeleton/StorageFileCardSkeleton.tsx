import {type FC} from "react";
import styles from "./StorageFileCardSkeleton.module.scss";

type TypeStorageFileCardSkeleton = {
  className?: string;
};

const StorageFileCardSkeleton: FC<TypeStorageFileCardSkeleton> = ({className}) => {
  return (
    <div className={`${styles.container} ${className || ""}`}>
      <div className={styles.imageContainer}>
        <div className={styles.imageBox} />
      </div>
      <div className={styles.nameContainer}>
        <div className={styles.nameBox} />
      </div>
    </div>
  );
};

export default StorageFileCardSkeleton;
