import React, {useState} from "react";
import {Button, Icon, Text} from "oziko-ui-kit";
import TitleForm from "../../molecules/title-form/TitleForm";
import {useBucket} from "../../../contexts/BucketContext";
import styles from "./AddBucketPopup.module.scss";

const AddBucketPopup = ({text}: {text?: string}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const {createBucket} = useBucket();

  const handleClose = () => {
    setIsOpen(false);
    setError(undefined);
  };

  const handleAddBucket = async (title: string) => {
    if (!title) {
      setError("This field is can not be left empty.");
      return;
    }

    if (title.length < 4) {
      setError("This field must be at least 4 characters long");
      return;
    }

    if (title.length > 100) {
      setError("This field cannot exceed 100 characters");
      return;
    }

    setError(undefined);
    setIsLoading(true);

    try {
      const result = await createBucket(title);
      if (result) handleClose();
    } catch (error) {
      console.error("Failed to add bucket:", error);
      setError("Something went wrong while adding the bucket");
    } finally {
      setIsLoading(false);
    }
  };

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
          onClose={handleClose}
          closeAfterSubmit={false}
          title="ADD NEW BUCKET"
          initialValue="New Bucket"
          onSubmit={handleAddBucket}
          loading={isLoading}
          error={error}
        />
      )}
    </>
  );
};

export default AddBucketPopup;
