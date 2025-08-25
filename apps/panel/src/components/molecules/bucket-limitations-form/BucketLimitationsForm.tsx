import {StringInput, NumberInput, type TypeFluidContainer, FlexElement} from "oziko-ui-kit";
import styles from "./BucketLimitiationsForm.module.scss";
import {
  LIMIT_EXCEED_BEHAVIOUR_OPTIONS,
  type TypeLimitExceedBehaviour
} from "../bucket-more-popup/BucketMorePopup";

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

const BucketLimitationsForm = ({setValues, values}: BucketLimitationsFormProps) => {
  const handleCountLimitChange = (countLimit: number) => setValues(prev => ({...prev, countLimit}));

  const handleLimitExceedBehaviourChange = (limitExceedBehaviour: TypeLimitExceedBehaviour) =>
    setValues(prev => ({...prev, limitExceedBehaviour}));

  return (
    <FlexElement direction="vertical" className={styles.formInputs}>
      <NumberInput
        className={styles.countLimitInput}
        onChange={handleCountLimitChange}
        label="Max Documents"
        value={values.countLimit}
      />
      <StringInput
        options={LIMIT_EXCEED_BEHAVIOUR_OPTIONS.map(i => i.label)}
        className={styles.limitExceedBehaviourInput}
        value={values.limitExceedBehaviour}
        onChange={handleLimitExceedBehaviourChange as (value: string) => void}
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

export default BucketLimitationsForm;
