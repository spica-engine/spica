import {memo, type FC} from "react";
import styles from "./CommitHistoryTemplate.module.scss";
import TimelineLine from "../../atoms/timeline-line/TimelineLine";
import CommitDateGroup from "../../organisms/commit-date-group/CommitDateGroup";
import type {Commit} from "../../../types/version-control";

type CommitGroup = {
  dateLabel: string;
  commits: Commit[];
};

type CommitHistoryTemplateProps = {
  groups: CommitGroup[];
};

const CommitHistoryTemplate: FC<CommitHistoryTemplateProps> = ({groups}) => {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <TimelineLine />
        {groups.map((group) => (
          <CommitDateGroup
            key={group.dateLabel}
            dateLabel={group.dateLabel}
            commits={group.commits}
          />
        ))}
      </div>
    </div>
  );
};

export default memo(CommitHistoryTemplate);
