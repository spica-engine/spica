import {memo, useState, useCallback} from "react";
import styles from "./DashboardCard.module.scss";
import {Button, FlexElement, Icon, Text} from "oziko-ui-kit";
import type {DashboardRatio} from "../../../store/api/dashboardApi";

type DashboardCardProps = {
  componentData?: any;
  ratio: DashboardRatio;
  title?: string;
  onUpdate?: (filter: object) => void;
};

const DashboardCard = ({componentData, title, onUpdate}: DashboardCardProps) => {
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const inputs = componentData?.inputs ?? [];

  const handleChange = useCallback((key: string, value: string) => {
    setFormValues(prev => ({...prev, [key]: value}));
  }, []);

  const handleSubmit = useCallback(() => {
    onUpdate?.(formValues);
  }, [formValues, onUpdate]);

  return (
    <FlexElement dimensionX="fill" dimensionY="fill" direction="vertical" gap={0} className={styles.dashboardCard}>
      <FlexElement dimensionX="fill" alignment="leftTop" className={styles.header}>
        <Text>{title ?? "Card"}</Text>
      </FlexElement>
      <FlexElement dimensionX="fill" alignment="leftTop" className={styles.content}>
        <FlexElement direction="vertical" gap={10} dimensionX="fill">
          {inputs.map((input: any) => (
            <FlexElement key={input.key} direction="vertical" gap={4} dimensionX="fill">
              <Text size="small" className={styles.label}>
                {input.title ?? input.key}
              </Text>
              <input
                type={input.type === "number" ? "number" : "text"}
                className={styles.input}
                placeholder={input.title ?? input.key}
                value={formValues[input.key] ?? ""}
                onChange={e => handleChange(input.key, e.target.value)}
              />
            </FlexElement>
          ))}
          {inputs.length > 0 && (
            <Button onClick={handleSubmit}>
              <Icon name="save" size="sm" />
              <Text size="small">Submit</Text>
            </Button>
          )}
        </FlexElement>
      </FlexElement>
    </FlexElement>
  );
};

export default memo(DashboardCard);
