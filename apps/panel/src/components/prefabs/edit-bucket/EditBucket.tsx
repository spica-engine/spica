import React, { useState, type FC, type ReactNode } from 'react'
import { Button, FluidContainer, Icon, Text, FlexElement, Modal, Input } from "oziko-ui-kit";
import type { BucketType } from "../../../store/api/bucketApi";
import styles from "./EditBucket.module.scss";
import { useRenameBucketMutation, useCreateBucketMutation, type CreateBucketRequest } from '../../../store/api/bucketApi';

type EditBucketProps = {
    bucket?: BucketType;
    mode?: 'edit' | 'create';
    initialValue?: string;
    children: (props: { 
        isOpen: boolean;
        onOpen: (e: React.MouseEvent) => void;
        onClose: () => void;
    }) => ReactNode;
}

const EditBucket: FC<EditBucketProps> = ({ bucket, mode = 'edit', initialValue = 'New Bucket', children }) => {
    const [renameBucket] = useRenameBucketMutation();
    const [createBucket] = useCreateBucketMutation();
    const isCreateMode = mode === 'create' || !bucket;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [value, setValue] = useState(isCreateMode ? '' : (bucket?.title || initialValue));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>("");
    
    const handleSave = async () => {
        try {
            setLoading(true);
            setError("");
            
            if (!value.trim()) {
                setError("This field cannot be left empty.");
                return;
            }

            if (value.length < 4) {
                setError("This field must be at least 4 characters long");
                return;
            }

            if (value.length > 100) {
                setError("This field cannot exceed 100 characters");
                return;
            }
            
            if (isCreateMode) {
                const createBucketRequest: CreateBucketRequest = {
                    title: value,
                    order: 0 // You might want to pass this as a prop or calculate it
                };
                const result = await createBucket(createBucketRequest);
                if (result.data) {
                    setIsModalOpen(false);
                }
            } else {
                await renameBucket({ newTitle: value, bucket: bucket! });
                setIsModalOpen(false);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setIsModalOpen(false);
        setValue(isCreateMode ? '' : (bucket?.title || initialValue));
        setError("");
    };

    const handleOpen = (e: React.MouseEvent) => {
        e.stopPropagation();
        setValue(isCreateMode ? '' : (bucket?.title || initialValue));
        setIsModalOpen(true);
    };

    return (
        <>
            {children({
                isOpen: isModalOpen,
                onOpen: handleOpen,
                onClose: handleClose
            })}
            {isModalOpen && (
                <Modal showCloseButton={false} onClose={handleClose} className={styles.modal} isOpen>
                    <FluidContainer
                        className={`${styles.container} ${error ? styles.containerWithError : ''}`}
                        direction="vertical"
                        gap={10}
                        mode="fill"
                        prefix={{
                            children: (
                                <div className={styles.header}>
                                    <Text className={styles.headerText}>
                                        {isCreateMode ? 'ADD NEW BUCKET' : 'EDIT NAME'}
                                    </Text>
                                    <button className={styles.closeButton} onClick={handleClose} type="button">
                                        <Icon name="close" size="sm" />
                                    </button>
                                </div>
                            )
                        }}
                        root={{
                            children: (
                                <div className={styles.body}>
                                    <FlexElement gap={0} className={styles.inputContainer}>
                                        <div className={styles.inputIconArea}>
                                            <Icon name="fields" size="sm" />
                                        </div>
                                        <Input
                                            className={styles.input}
                                            onChange={e => setValue(e.target.value)}
                                            placeholder={isCreateMode ? initialValue : "Name"}
                                            value={value}
                                        />
                                    </FlexElement>
                                    {error && (
                                        <Text variant="danger" className={styles.errorText}>
                                            {error}
                                        </Text>
                                    )}
                                </div>
                            )
                        }}
                        suffix={{
                            dimensionX: "fill",
                            alignment: "rightCenter",
                            children: (
                                <FlexElement gap={10} className={styles.buttonsContainer}>
                                    <Button
                                        className={styles.cancelButton}
                                        variant="text"
                                        onClick={handleClose}
                                        disabled={loading}
                                    >
                                        <Icon name="close" />
                                        <Text>Cancel</Text>
                                    </Button>
                                    <div className={styles.addButtonWrapper}>
                                        <Button
                                            className={styles.addButton}
                                            onClick={handleSave}
                                            disabled={loading}
                                            loading={loading}
                                        >
                                            <Icon name="save" />
                                            <Text className={styles.addButtonText}>Save</Text>
                                        </Button>
                                    </div>
                                </FlexElement>
                            )
                        }}
                    />
                </Modal>
            )}
        </>
    );
};

export default EditBucket;