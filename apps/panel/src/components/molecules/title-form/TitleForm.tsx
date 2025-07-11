import {Button, FluidContainer, Icon, Text, StringInput, FlexElement} from "oziko-ui-kit";
import {type FC, useState} from "react";
import styles from "./TitleForm.module.scss";

type TypeTitleFormProps = {
  onSave: (newTitle: string) => void;
  onCancel?: () => void;
  initialValue: string;
  error?: string;
  loading?: boolean;
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
