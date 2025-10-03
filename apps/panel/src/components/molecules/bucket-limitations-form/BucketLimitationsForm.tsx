import {StringInput, NumberInput, type TypeFluidContainer, FlexElement} from "oziko-ui-kit";
import styles from "./BucketLimitiationsForm.module.scss";
import {memo, useState} from "react";

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
  const [isValuesChanged, setIsValuesChanged] = useState({
    countLimit: false,
    limitExceedBehaviour: false
  });
  const handleCountLimitChange = (countLimit: number) => {
    setValues(prev => ({...prev, countLimit}));
    setIsValuesChanged(prev => ({...prev, countLimit: true}));
  };

  const handleLimitExceedBehaviourChange = (value: string) => {
    setValues(prev => ({...prev, limitExceedBehaviour: value as TypeLimitExceedBehaviour}));
    setIsValuesChanged(prev => ({...prev, limitExceedBehaviour: true}));
  };
  return (
    <FlexElement direction="vertical" className={styles.formInputs}>
      <NumberInput
        className={`${styles.countLimitInput} ${isValuesChanged.countLimit && styles.activeFormInputs}`}
        onChange={handleCountLimitChange}
        inputProps={{placeholder: "Max Documents"}}
        value={values.countLimit}
        onClick={e => e.stopPropagation()}
      />
      <StringInput
        options={LIMIT_EXCEED_BEHAVIOUR_LABELS}
        className={` ${styles.limitExceedBehaviourInput} ${isValuesChanged.limitExceedBehaviour && styles.activeFormInputs}`}
        value={values.limitExceedBehaviour}
        onChange={handleLimitExceedBehaviourChange}
        iconName="formatListChecks"
        selectProps={
          {
            placeholder: "Choose limit-reached action",
            optionProps: {className: styles.selectOption},
            popupClassName: styles.selectPopup
          } as TypeFluidContainer
        }
      />
    </FlexElement>
  );
};

export default memo(BucketLimitationsForm);
