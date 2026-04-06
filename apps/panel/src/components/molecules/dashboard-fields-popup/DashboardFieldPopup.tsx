import {
  Button,
  FluidContainer,
  Icon,
  Text,
  useInputRepresenter,
  type TypeInputType
} from "oziko-ui-kit";
import styles from "./DashboardFieldPopup.module.scss";
import {type FC, memo, useState, useCallback} from "react";

type DashboardFieldPopupProps = {
  onClickApply?: (filterValues: Record<string, string>) => void;
  onClickCancel?: () => void;
  initialValues?: Record<string, string>;
  inputs?: {
    [key: string]: {
      type: Exclude<TypeInputType, "location" | "storage">;
      title: string;
      description?: string;
    };
  };
};
const DashboardFieldPopup: FC<DashboardFieldPopupProps> = ({
  onClickApply,
  onClickCancel,
  initialValues,
  inputs = {}
}) => {
  const defaultValues = initialValues ?? Object.keys(inputs).reduce(
    (acc, key) => {
      acc[key] = "";
      return acc;
    },
    {} as Record<string, string>
  );

  const [filterValues, setFilterValues] = useState<Record<string, string>>(defaultValues);

  const handleChange = useCallback((newValues: Record<string, string>) => {
    setFilterValues(prev => ({...prev, ...newValues}));
  }, []);

  const inputRepresenter = useInputRepresenter({
    properties: inputs,
    value: filterValues,
    onChange: handleChange
  });

  const handleApply = useCallback(() => {
    onClickApply?.(filterValues);
  }, [onClickApply, filterValues]);

  return (
    <FluidContainer
      className={styles.container}
      direction="vertical"
      gap={10}
      prefix={{
        children: <Text className={styles.title}>Fields</Text>
      }}
      root={{
        dimensionX: 360,
        direction: "vertical",
        children: inputRepresenter
      }}
      suffix={{
        dimensionX: "fill",
        alignment: "rightCenter",
        gap: 10,
        children: (
          <>
            <Button className={styles.cancelButton} color="transparent" onClick={onClickCancel}>
              <Icon name="close"></Icon>
              <Text>Cancel</Text>
            </Button>
            <Button onClick={handleApply}>
              <Icon name="filter"></Icon>
              <Text className={styles.buttonText}>Apply</Text>
            </Button>
          </>
        )
      }}
    />
  );
};

export default memo(DashboardFieldPopup);
