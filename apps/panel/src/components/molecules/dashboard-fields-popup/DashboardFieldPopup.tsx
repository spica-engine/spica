import {Button, FluidContainer, Icon, Text} from "oziko-ui-kit";
import styles from "./DashboardFieldPopup.module.scss";
import {type FC, memo} from "react";
import useInputRepresenter from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";
import type {TypeInputType} from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";

type DashboardFieldPopupProps = {
  onClickApply?: () => void;
  onClickCancel?: () => void;
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
  inputs = {}
}) => {
  const initialValue = Object.keys(inputs).reduce(
    (acc, key) => {
      acc[key] = "";
      return acc;
    },
    {} as Record<string, string>
  );

  const inputRepresenter = useInputRepresenter({
    properties: inputs,
    value: initialValue,
    onChange: () => {}
  });
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
            <Button onClick={onClickApply}>
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
