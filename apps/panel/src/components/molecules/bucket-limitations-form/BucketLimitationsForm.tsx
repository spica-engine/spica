import {FluidContainer, Icon, Input, FlexElement, Button, Text, Select} from "oziko-ui-kit";
import styles from "./BucketLimitiationsForm.module.scss";
import type {BucketType} from "src/services/bucketService";
import {useState} from "react";

type BucketLimitationsFormProps = {
  onSubmit: (countLimit: number, limitExceedBehaviour: "prevent" | "remove") => void;
  bucket: BucketType;
  loading?: boolean;
  className: string;
  error: string | null;
};

const BucketLimitationsForm = ({
  onSubmit,
  loading,
  bucket,
  className,
  error,
}: BucketLimitationsFormProps) => {
  const [values, setValues] = useState({
    countLimit: bucket.documentSettings.countLimit,
    limitExceedBehaviour: bucket.documentSettings.limitExceedBehaviour
  });

  const handleSubmit = () => {
    onSubmit(Number(values.countLimit), values.limitExceedBehaviour);
  };

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
                <label htmlFor="bucketLimitationsCountLimit">Maximum number of documents</label>
                <FlexElement gap={5} className={styles.countLimitInputContainer}>
                  <Icon name="numericBox" size="md" />
                  <Input
                    className={styles.countLimitInput}
                    onChange={e => setValues({...values, countLimit: e.target.value})}
                    placeholder="Maximum number of documents"
                    value={values.countLimit}
                  />
                </FlexElement>
              </div>
              <div>
                <label htmlFor="bucketLimitationsLimitExceedBehaviour">After reached limit</label>
                <FlexElement gap={5} className={styles.limitExceedBehaviourInputContainer}>
                  <Icon name="formatListChecks" size="md" />
                  <Select
                    id="bucketLimitationsLimitExceedBehaviour"
                    className={styles.limitExceedBehaviourInput}
                    value={values.limitExceedBehaviour}
                    options={limitExceedBehaviourOptions}
                    optionProps={{className: styles.selectOption}}
                    popupClassName={styles.selectDropdown}
                    onChange={val => setValues({...values, limitExceedBehaviour: val})}
                  />
                </FlexElement>
              </div>
            </div>
            <div className={styles.applyButtonContainer}>
              <div className={styles.errorTextContainer}>
              {error && <Text className={styles.errorText} variant="danger">{error}</Text>}
              </div>
              <Button variant="text" className={styles.applyButton} disabled={loading} loading={loading} onClick={handleSubmit}>
                <Icon name="filter" size="sm" />
                Apply
              </Button>
            </div>
          </div>
        )
      }}
    />
  );
};

export default BucketLimitationsForm;
