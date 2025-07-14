import {Button, FluidContainer, Icon, Text, StringInput, FlexElement} from "oziko-ui-kit";
import {type FC, useCallback, useState} from "react";
import styles from "./TitleForm.module.scss";
import useApi from "../../../hooks/useApi";

type TypeTitleFormProps = {
  onSave: (newTitle: string) => void;
  onCancel?: () => void;
  initialValue: string;
  error?: string;
  loading?: boolean;
};

type TitleFormWrapperProps = {
  onSubmit?: () => void;
  bucketId: string;
  initialValue: string;
  onCancel?: () => void;
};

export const TitleFormWrapper = ({
  onSubmit,
  bucketId,
  initialValue,
  onCancel
}: TitleFormWrapperProps) => {
  const {request, loading, error} = useApi({
    endpoint: `/api/bucket/${bucketId}`,
    method: "patch"
  });

  const onSave = useCallback(
    (newTitle: string) => {
      request({body: {title: newTitle}}).then(result => {
        if (!result) return;
        onSubmit?.();
      });
    },
    [onSubmit, request]
  );

  return (
    <TitleForm
      onCancel={onCancel}
      onSave={onSave}
      initialValue={initialValue}
      loading={loading}
      error={error ?? ""}
    />
  );
};

const TitleForm: FC<TypeTitleFormProps> = ({initialValue, error, loading, onSave, onCancel}) => {
  const [value, setValue] = useState(initialValue);

  return (
    <FluidContainer
      className={styles.container}
      direction="vertical"
      gap={10}
      prefix={{
        children: <Text className={styles.title}>Edit Name</Text>
      }}
      root={{
        dimensionX: 360,
        children: (
          <div>
            <StringInput onChange={setValue} label={"Name"} value={value} />
            <Text className={styles.errorText}>{error}</Text>
          </div>
        )
      }}
      suffix={{
        dimensionX: "fill",
        alignment: "rightCenter",
        children: (
          <FlexElement>
            <Button onClick={() => onCancel?.()} disabled={loading}>
              <Icon name="close" />
              <Text className={styles.buttonText}>Cancel</Text>
            </Button>
            <Button onClick={() => onSave(value)} disabled={loading} loading={loading}>
              <Icon name="save" />
              <Text className={styles.buttonText}>Save</Text>
            </Button>
          </FlexElement>
        )
      }}
    />
  );
};

export default TitleForm;
