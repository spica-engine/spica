import {memo, useCallback, useState} from "react";
import {Button, DatePicker, FlexElement, Icon, Popover, Text} from "oziko-ui-kit";
import styles from "./FunctionLogPage.module.scss";

type FunctionLogFilterProps = {
  begin: Date;
  end: Date;
  onApply: (begin: Date, end: Date) => void;
};

const FunctionLogFilter = ({begin, end, onApply}: FunctionLogFilterProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localBegin, setLocalBegin] = useState<Date | null>(begin);
  const [localEnd, setLocalEnd] = useState<Date | null>(end);

  const handleOpen = useCallback(() => {
    setLocalBegin(begin);
    setLocalEnd(end);
    setIsOpen(true);
  }, [begin, end]);

  const handleClose = useCallback(() => setIsOpen(false), []);

  const handleApply = useCallback(() => {
    if (localBegin && localEnd) {
      onApply(localBegin, localEnd);
      setIsOpen(false);
    }
  }, [localBegin, localEnd, onApply]);

  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-US", {month: "short", day: "numeric", year: "numeric"});

  return (
    <div className={styles.topControls}>
      <Text className={styles.dateRangeText}>
        {formatDate(begin)} – {formatDate(end)}
      </Text>
      <Popover
        open={isOpen}
        onClose={handleClose}
        placement="bottomEnd"
        content={
          <div className={styles.filterContent}>
            <Text size="medium" style={{fontWeight: 600}}>
              Date Range
            </Text>
            <FlexElement direction="vertical" gap={12} dimensionX="fill">
              <FlexElement direction="vertical" gap={4} dimensionX="fill">
                <Text size="small">Start Date</Text>
                <DatePicker
                  value={localBegin}
                  onChange={v => setLocalBegin(v ? new Date(v as string) : null)}
                  placeholder="Start date"
                  format="YYYY-MM-DD HH:mm:ss"
                  showTime
                  suffixIcon={<Icon name="chevronDown" />}
                />
              </FlexElement>
              <FlexElement direction="vertical" gap={4} dimensionX="fill">
                <Text size="small">End Date</Text>
                <DatePicker
                  value={localEnd}
                  onChange={v => setLocalEnd(v ? new Date(v as string) : null)}
                  placeholder="End date"
                  format="YYYY-MM-DD HH:mm:ss"
                  showTime
                  suffixIcon={<Icon name="chevronDown" />}
                />
              </FlexElement>
            </FlexElement>
            <div className={styles.filterActions}>
              <Button variant="text" onClick={handleClose} type="button">
                <Icon name="close" size="sm" />
                Cancel
              </Button>
              <Button onClick={handleApply} disabled={!localBegin || !localEnd}>
                <Icon name="filter" size="sm" />
                Apply
              </Button>
            </div>
          </div>
        }
      >
        <Button variant="solid" color="default" onClick={handleOpen}>
          <Icon name="filter" />
          Filter
        </Button>
      </Popover>
    </div>
  );
};

export default memo(FunctionLogFilter);
