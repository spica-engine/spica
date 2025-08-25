import {
  FluidContainer,
  type TypeValue,
  StringInput,
  NumberInput,
  type TypeFluidContainer
} from "oziko-ui-kit";
import styles from "./BucketLimitiationsForm.module.scss";
import {
  LIMIT_EXCEED_BEHAVIOUR_OPTIONS,
  type TypeLimitExceedBehaviour
} from "../bucket-more-popup/BucketMorePopup";

type BucketLimitationsFormProps = {
  className?: string;
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

const BucketLimitationsForm = ({className, setValues, values}: BucketLimitationsFormProps) => {
  const handleCountLimitChange = (countLimit: number) => setValues(prev => ({...prev, countLimit}));

  const handleLimitExceedBehaviourChange = (limitExceedBehaviour: TypeLimitExceedBehaviour) =>
    setValues(prev => ({...prev, limitExceedBehaviour}));

  return (
    <FluidContainer
      direction="vertical"
      gap={0}
      className={`${styles.container} ${className ?? ""}`}
      suffix={{
        children: (
          <div className={styles.formContainer}>
            <div className={styles.formInputs}>
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
            </div>
          </div>
        )
      }}
    />
  );
};

export default BucketLimitationsForm;
