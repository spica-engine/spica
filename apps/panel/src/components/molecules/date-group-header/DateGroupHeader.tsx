import {memo, type FC} from "react";
import {Text} from "oziko-ui-kit";
import styles from "./DateGroupHeader.module.scss";
import TimelineMarker from "../../atoms/timeline-marker/TimelineMarker";

type DateGroupHeaderProps = {
  dateLabel: string;
};

const DateGroupHeader: FC<DateGroupHeaderProps> = ({dateLabel}) => {
  return (
    <div className={styles.header}>
      <TimelineMarker />
      <Text className={styles.label}>{dateLabel}</Text>
    </div>
  );
};

export default memo(DateGroupHeader);
