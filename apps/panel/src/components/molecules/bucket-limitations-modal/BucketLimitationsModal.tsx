import {Modal, FluidContainer, Icon, Text, Input, Select, Button} from "oziko-ui-kit";
import styles from "./BucketLimitiationsModal.module.scss";
import type {BucketType} from "src/services/bucketService";
import {useState} from "react";

type BucketLimitationsModalProps = {
  onClose: () => void;
  onSubmit: (countLimit: number, limitExceedBehaviour: "prevent" | "remove") => void;
  bucket: BucketType;
  loading?: boolean;
};

const BucketLimitationsModal = ({
  onClose,
  onSubmit,
  loading,
  bucket
}: BucketLimitationsModalProps) => {
  const [values, setValues] = useState({
    countLimit: bucket.documentSettings.countLimit,
    limitExceedBehaviour: bucket.documentSettings.limitExceedBehaviour
  });

  const handleSubmit = () => {
    onSubmit(values.countLimit, values.limitExceedBehaviour);
  };

  const limitExceedBehaviourOptions = [
    {label: "Do not insert", value: "prevent"},
    {label: "Insert but delete the oldest", value: "remove"}
  ];

  return (
    <Modal onClose={onClose} className={styles.container} isOpen showCloseButton={false}>
      <Modal.Body className={styles.contentContainer}>
        <FluidContainer
          direction="vertical"
          gap={0}
          className={styles.headerContainer}
          prefix={{
            children: (
              <div className={styles.header}>
                <Text className={styles.headerText}>LIMITATIONS</Text>
              </div>
            )
          }}
          suffix={{
            children: (
              <div className={styles.formContainer}>
                <div className={styles.formInputs}>
                  <div>
                    <label htmlFor="bucketLimitationsCountLimit">Maximum number of documents</label>
                    <Input
                      id="bucketLimitationsCountLimit"
                      className={styles.countLimitInput}
                      value={values.countLimit}
                      onChange={e => setValues({...values, countLimit: Number(e.target.value)})}
                      type="number"
                      name="Count Limit"
                      min={0}
                    />
                  </div>
                  <div>
                    <label htmlFor="bucketLimitationsLimitExceedBehaviour">
                      After reached limit
                    </label>
                    <Select
                      id="bucketLimitationsLimitExceedBehaviour"
                      className={styles.limitExceedBehaviourInput}
                      value={values.limitExceedBehaviour}
                      options={limitExceedBehaviourOptions}
                      onChange={val => setValues({...values, limitExceedBehaviour: val})}
                    />
                  </div>
                </div>
                <div className={styles.buttonsContainer}>
                  <Button variant="text" onClick={onClose} disabled={loading}>
                    <Icon name="close" size="sm" />
                    Cancel
                  </Button>
                  <Button disabled={loading} loading={loading} onClick={handleSubmit}>
                    <Icon name="filter" size="sm" />
                    Apply
                  </Button>
                </div>
              </div>
            )
          }}
        />
      </Modal.Body>
    </Modal>
  );
};

export default BucketLimitationsModal;
