import React, {memo, type FC} from "react";
import {
  Accordion,
  Button,
  FlexElement,
  FluidContainer,
  Icon,
  InputWithIcon,
  Text,
  type TypeAccordionItem
} from "oziko-ui-kit";
import styles from "./FunctionTrigger.module.scss";

type FunctionTriggerTypes = "http" | "schedule" | "database" | "bucket" | "system" | "firehose";

type TriggerData = {
  options?: Record<string, any>;
  type?: FunctionTriggerTypes;
  active?: boolean;
};

type TypeFunctionTrigger = {
  [triggerName: string]: TriggerData;
};

type TypeFunctionTriggerProps = {
  variables?: TypeFunctionTrigger;
  addNewOnClick?: () => void;
  deleteTrigger?: (triggerName: string) => void;
};

const FunctionTrigger: FC<TypeFunctionTriggerProps> = ({
  variables = [],
  addNewOnClick,
  deleteTrigger
}) => {
  const accordionItems: TypeAccordionItem[] = [
    {
      title: (
        <Text className={styles.title} size="medium">
          Triggers
        </Text>
      ),
      content: (
        <FlexElement direction="vertical" dimensionX="fill" gap={10} className={styles.content}>
          {variables &&
            Object.entries(variables).map(([triggerName]) => (
              <FluidContainer
                key={triggerName}
                dimensionX="fill"
                alignment="leftCenter"
                prefix={{
                  children: <Icon name="chevronRight" />
                }}
                root={{
                  alignment: "leftCenter",
                  dimensionX: "fill",
                  children: <Text size="medium">{triggerName}</Text>
                }}
                suffix={{
                  children: (
                    <Button
                      className={`${styles.dangerButton}`}
                      color="default"
                      variant="icon"
                      onClick={() => deleteTrigger?.(triggerName)}
                    >
                      <Icon name="delete" />
                    </Button>
                  )
                }}
              />
            ))}

          <Button fullWidth color="default" onClick={addNewOnClick}>
            <Icon name="plus" />
            Add New Trigger
          </Button>
        </FlexElement>
      )
    }
  ];

  return <Accordion items={accordionItems} suffixOnHover={false} noBackgroundOnFocus />;
};

export default memo(FunctionTrigger);
