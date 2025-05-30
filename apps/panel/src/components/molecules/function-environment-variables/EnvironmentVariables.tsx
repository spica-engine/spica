import {
  Accordion,
  Button,
  FlexElement,
  FluidContainer,
  Icon,
  Text,
  type TypeAccordionItem
} from "oziko-ui-kit";
import React, {memo, type FC} from "react";
import styles from "./EnvironmentVariables.module.scss";

type TypeEnvironmentVariable = {
  key: string;
  value: string;
  editOnClick?: () => void;
  deleteOnClick?: () => void;
};

type TypeEnvironmentVariablesProps = {
  variables?: TypeEnvironmentVariable[];
  addNewOnClick?: () => void;
};

const EnvironmentVariables: FC<TypeEnvironmentVariablesProps> = ({
  variables = [],
  addNewOnClick
}) => {
  const accordionItems: TypeAccordionItem[] = [
    {
      title: (
        <Text className={styles.title} size="medium">
          Environment Variables
        </Text>
      ),
      content: (
        <FlexElement direction="vertical" dimensionX="fill" gap={10}>
          {variables.length > 0 &&
            variables.map(({key, value, editOnClick, deleteOnClick}, index) => (
              <FluidContainer
                key={index}
                dimensionX="fill"
                alignment="leftCenter"
                root={{
                  children: (
                    <Text className={styles.content} size="medium">
                      {key}={value}
                    </Text>
                  )
                }}
                suffix={{
                  gap: 10,
                  children: (
                    <>
                      <Button
                        className={styles.button}
                        color="default"
                        variant="icon"
                        onClick={editOnClick}
                      >
                        <Icon name="pencil" />
                      </Button>
                      <Button
                        className={`${styles.button} ${styles.dangerButton}`}
                        color="default"
                        variant="icon"
                        onClick={deleteOnClick}
                      >
                        <Icon name="delete" />
                      </Button>
                    </>
                  )
                }}
              />
            ))}
          <Button fullWidth color="default" onClick={addNewOnClick}>
            <Icon name="plus" />
            Add New Environment Variable
          </Button>
        </FlexElement>
      )
    }
  ];

  return (
    <Accordion
      items={accordionItems}
      defaultActiveIndex={0}
      suffixOnHover={false}
      noBackgroundOnFocus
    />
  );
};

export default memo(EnvironmentVariables);
