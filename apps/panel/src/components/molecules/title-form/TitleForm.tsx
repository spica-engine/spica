import {Button, FluidContainer, Icon, Text, StringInput} from "oziko-ui-kit";
import {type FC, useState} from "react";
import styles from "./TitleForm.module.scss";

type TypeTitleFormProps = {
  onSubmit: (newTitle: string) => void;
  initialValue: string;
  error?: string;
  loading?: boolean;
};

const TitleForm: FC<TypeTitleFormProps> = ({initialValue, error, loading, onSubmit}) => {
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
          <Button onClick={() => onSubmit(value)} disabled={loading} loading={loading}>
            <Icon name="save" />
            <Text className={styles.buttonText}>Save</Text>
          </Button>
        )
      }}
    />
  );
};

export default TitleForm;
