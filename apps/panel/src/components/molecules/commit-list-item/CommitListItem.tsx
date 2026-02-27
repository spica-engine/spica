import {memo, type FC} from "react";
import {Text} from "oziko-ui-kit";
import styles from "./CommitListItem.module.scss";

type CommitListItemProps = {
  title: string;
  hash: string;
  author: string;
  relativeTime: string;
};

const CommitListItem: FC<CommitListItemProps> = ({title, hash, author, relativeTime}) => {
  return (
    <div className={styles.card}>
      <div className={styles.topRow}>
        <Text className={styles.title}>{title}</Text>
        <Text className={styles.hash}>{hash}</Text>
      </div>
      <div className={styles.bottomRow}>
        <Text className={styles.meta}>{author}</Text>
        <Text className={styles.meta}>{relativeTime}</Text>
      </div>
    </div>
  );
};

export default memo(CommitListItem);
