import {memo, useCallback, useState} from "react";
import {Button, DatePicker, FlexElement, Icon, Popover, Select, Text} from "oziko-ui-kit";
import styles from "./FunctionLogPage.module.scss";

const LEVEL_OPTIONS = [
  {value: 0, label: "Debug"},
  {value: 1, label: "Log"},
  {value: 2, label: "Info"},
  {value: 3, label: "Warning"},
  {value: 4, label: "Error"},
];

type FunctionOption = {value: string; label: string};

type FunctionLogFilterProps = {
  begin: Date;
  end: Date;
  functionOptions?: FunctionOption[];
  selectedFunctions?: string[];
  selectedLevels: number[];
  onApply: (begin: Date, end: Date, functions: string[], levels: number[]) => void;
  hideFunctionFilter?: boolean;
};

const FunctionLogFilter = ({
  begin,
  end,
  functionOptions = [],
  selectedFunctions = [],
  selectedLevels,
  onApply,
  hideFunctionFilter = false,
}: FunctionLogFilterProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localBegin, setLocalBegin] = useState<Date | null>(begin);
  const [localEnd, setLocalEnd] = useState<Date | null>(end);
  const [localFunctions, setLocalFunctions] = useState<string[]>(selectedFunctions);
  const [localLevels, setLocalLevels] = useState<number[]>(selectedLevels);

  const handleOpen = useCallback(() => {
    setLocalBegin(begin);
    setLocalEnd(end);
    setLocalFunctions(selectedFunctions);
    setLocalLevels(selectedLevels);
    setIsOpen(true);
  }, [begin, end, selectedFunctions, selectedLevels]);

  const handleClose = useCallback(() => setIsOpen(false), []);

  const handleApply = useCallback(() => {
    if (localBegin && localEnd) {
      onApply(localBegin, localEnd, localFunctions, localLevels);
      setIsOpen(false);
    }
  }, [localBegin, localEnd, localFunctions, localLevels, onApply]);

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
              Filters
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
              {!hideFunctionFilter && (
                <FlexElement direction="vertical" gap={4} dimensionX="fill">
                  <Text size="small">Function</Text>
                  <Select
                    options={functionOptions}
                    value={localFunctions}
                    onChange={v => setLocalFunctions(v as string[])}
                    placeholder="All functions"
                    multiple
                    dimensionX="fill"
                  />
                </FlexElement>
              )}
              <FlexElement direction="vertical" gap={4} dimensionX="fill">
                <Text size="small">Log Level</Text>
                <Select
                  options={LEVEL_OPTIONS}
                  value={localLevels}
                  onChange={v => setLocalLevels(v as number[])}
                  placeholder="All levels"
                  multiple
                  dimensionX="fill"
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
