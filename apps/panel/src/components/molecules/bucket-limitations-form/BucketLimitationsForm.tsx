import {StringInput, NumberInput, type TypeFluidContainer, FlexElement} from "oziko-ui-kit";
import styles from "./BucketLimitiationsForm.module.scss";
import {memo} from "react";

export type TypeLimitExceedBehaviour = "prevent" | "remove";
export const LIMIT_EXCEED_BEHAVIOUR_OPTIONS = [
  {label: "Do not insert", value: "prevent"},
  {label: "Insert but delete the oldest", value: "remove"}
] as {label: string; value: TypeLimitExceedBehaviour}[];

type BucketLimitationsFormProps = {
  setValues: React.Dispatch<
    React.SetStateAction<{
      countLimit: number;
      limitExceedBehaviour: TypeLimitExceedBehaviour;
    }>
  >;
  values: {
    countLimit: number;
    limitExceedBehaviour: TypeLimitExceedBehaviour;
  };
};

const LIMIT_EXCEED_BEHAVIOUR_LABELS = LIMIT_EXCEED_BEHAVIOUR_OPTIONS.map(i => i.label);

const BucketLimitationsForm = ({setValues, values}: BucketLimitationsFormProps) => {
  const handleCountLimitChange = (countLimit: number) => setValues(prev => ({...prev, countLimit}));

  const handleLimitExceedBehaviourChange = (value: string) =>
    setValues(prev => ({...prev, limitExceedBehaviour: value as TypeLimitExceedBehaviour}));

  return (
    <FlexElement direction="vertical" className={styles.formInputs}>
      <NumberInput
        className={styles.countLimitInput}
        onChange={handleCountLimitChange}
        label="Max Documents"
        value={values.countLimit}
      />
      <StringInput
        options={LIMIT_EXCEED_BEHAVIOUR_LABELS}
        className={styles.limitExceedBehaviourInput}
        value={values.limitExceedBehaviour}
        onChange={handleLimitExceedBehaviourChange}
        label="Choose limit-reached action"
        selectProps={
          {
            optionProps: {className: styles.selectOption},
            popupClassName: styles.selectPopup
          } as TypeFluidContainer
        }
      />
    </FlexElement>
  );
};

export default memo(BucketLimitationsForm);
