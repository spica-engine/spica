import React, {useState} from "react";
import {Button, Icon, Text} from "oziko-ui-kit";
import TitleForm from "../../molecules/title-form/TitleForm";
import {useBucket} from "../../../contexts/BucketContext";
import styles from "./AddBucketPopup.module.scss";

const AddBucketPopup = ({text}: {text?: string}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const {addBucket} = useBucket();
  const handleAddBucket = async (title: string) => {
    setIsLoading(true);
    await addBucket(title).then(result => {
      if (!result) return;
      setIsOpen(false);
    }).finally(() => {
      setIsLoading(false);
    });
  }
  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className={styles.addNewButton}
        color="transparent"
        variant="text"
      >
        <Icon name="plus" size="xs" />
        <Text className={styles.noLineHeight} size="medium">
          {text}
        </Text>
      </Button>
      {isOpen && (
        <TitleForm
          onClose={() => setIsOpen(false)}
          closeAfterSubmit={false}
          title="Add New Bucket"
          initialValue=""
          onSubmit={handleAddBucket}
          loading={isLoading}
        />
      )}
    </>
  );
};

export default AddBucketPopup;