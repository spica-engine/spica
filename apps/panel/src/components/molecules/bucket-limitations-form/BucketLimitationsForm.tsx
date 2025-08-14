import {FluidContainer, Icon, Input, FlexElement, Select, type TypeValue} from "oziko-ui-kit";
import styles from "./BucketLimitiationsForm.module.scss";

type BucketLimitationsFormProps = {
  className: string;
  setValues: React.Dispatch<
    React.SetStateAction<{
      countLimit: any;
      limitExceedBehaviour: any;
    }>
  >;
  values: {
    countLimit: number;
    limitExceedBehaviour: TypeValue;
  };
};

const BucketLimitationsForm = ({className, setValues, values}: BucketLimitationsFormProps) => {
  const handleCountLimitChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues(prev => ({...prev, countLimit: Number(e.target.value)}));

  const handleLimitExceedBehaviourChange = (limitExceedBehaviour: TypeValue) =>
    setValues(prev => ({...prev, limitExceedBehaviour}));

  const limitExceedBehaviourOptions = [
    {label: "Do not insert", value: "prevent"},
    {label: "Insert but delete the oldest", value: "remove"}
  ];

  return (
    <FluidContainer
      direction="vertical"
      gap={0}
      className={`${styles.container} ${className ?? ""}`}
      suffix={{
        children: (
          <div className={styles.formContainer}>
            <div className={styles.formInputs}>
              <div>
                <label htmlFor="bucketLimitationsCountLimit">Max number of documents</label>
                <FlexElement gap={5} className={styles.countLimitInputContainer}>
                  <Icon name="numericBox" size="md" />
                  <Input
                    className={styles.countLimitInput}
                    onChange={handleCountLimitChange}
                    placeholder="Max number of documents"
                    value={values.countLimit}
                  />
                </FlexElement>
              </div>
              <div>
                <label htmlFor="bucketLimitationsLimitExceedBehaviour">
                  Choose limit-reached action
                </label>
                <FlexElement gap={5} className={styles.limitExceedBehaviourInputContainer}>
                  <Icon name="formatListChecks" size="md" />
                  <Select
                    id="bucketLimitationsLimitExceedBehaviour"
                    className={styles.limitExceedBehaviourInput}
                    value={values.limitExceedBehaviour}
                    options={limitExceedBehaviourOptions}
                    optionProps={{className: styles.selectOption}}
                    popupClassName={styles.selectDropdown}
                    onChange={handleLimitExceedBehaviourChange}
                  />
                </FlexElement>
              </div>
            </div>
          </div>
        )
      }}
    />
  );
};

export default BucketLimitationsForm;
