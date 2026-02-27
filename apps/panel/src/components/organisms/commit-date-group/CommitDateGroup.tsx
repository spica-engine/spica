import {memo, type FC} from "react";
import styles from "./CommitDateGroup.module.scss";
import DateGroupHeader from "../../molecules/date-group-header/DateGroupHeader";
import CommitListItem from "../../molecules/commit-list-item/CommitListItem";
import type {Commit} from "../../../types/version-control";

type CommitDateGroupProps = {
  dateLabel: string;
  commits: Commit[];
};

const CommitDateGroup: FC<CommitDateGroupProps> = ({dateLabel, commits}) => {
  return (
    <div className={styles.group}>
      <DateGroupHeader dateLabel={dateLabel} />
      <div className={styles.commitList}>
        {commits.map((commit) => (
          <CommitListItem
            key={commit.hash}
            title={commit.title}
            hash={commit.hash}
            author={commit.author}
            relativeTime={commit.relativeTime}
          />
        ))}
      </div>
    </div>
  );
};

export default memo(CommitDateGroup);
