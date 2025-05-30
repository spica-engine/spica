import React, {memo, type FC} from "react";
import styles from "./FunctionDependencies.module.scss";
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

type TypeEnvironmentVariable = {
  dependency: string;
  version: string;
  refreshOnClick?: () => void;
  deleteOnClick?: () => void;
};

type TypeEnvironmentVariablesProps = {
  variables?: TypeEnvironmentVariable[];
  addNewOnClick?: () => void;
};

const FunctionDependencies: FC<TypeEnvironmentVariablesProps> = ({
  variables = [],
  addNewOnClick
}) => {
  const accordionItems: TypeAccordionItem[] = [
    {
      title: (
        <Text className={styles.title} size="medium">
          Dependencies
        </Text>
      ),
      content: (
        <FlexElement direction="vertical" dimensionX="fill" gap={10}>
          {variables.length > 0 &&
            variables.map(({dependency, version, refreshOnClick, deleteOnClick}, index) => (
              <FluidContainer
                key={index}
                dimensionX="fill"
                alignment="leftCenter"
                root={{
                  children: (
                    <Text size="medium">
                      {dependency} {`@${version}`}
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
                        onClick={refreshOnClick}
                      >
                        <Icon name="refresh" />
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
          <InputWithIcon
            gap={10}
            dimensionX={400}
            inputProps={{
              placeholder: "Name",
              onKeyDown: e => {
                if (e.key === "Enter") {
                  addNewOnClick?.();
                }
              }
            }}
            suffix={{
              children: (
                <Button
                  containerProps={{
                    alignment: "rightTop"
                  }}
                  onClick={addNewOnClick}
                  className={styles.addButton}
                  variant="icon"
                  color="default"
                >
                  <Icon name="plus" className={styles.icon} />
                </Button>
              )
            }}
            className={styles.input}
          ></InputWithIcon>
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

export default memo(FunctionDependencies);
