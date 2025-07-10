import {Button, FluidContainer, Icon, Text, StringInput} from "oziko-ui-kit";
import {type FC, useState} from "react";
import styles from "./TitleForm.module.scss";
import useApi from "../../../hooks/useApi";

type TypeTitleFormProps = {
  initalValue: string;
  onSave: () => void;
  bucketId: string;
};

const TitleForm: FC<TypeTitleFormProps> = ({initalValue, onSave, bucketId}) => {
  const [value, setValue] = useState(initalValue);
  const {request, loading, error} = useApi({
    endpoint: `/api/bucket/${bucketId}`,
    method: "patch"
  });
  const onSubmit = () => {
    request({body: {title: value}}).then(result => {
      if (!result) return;
      onSave?.();
    });
  };
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
          <Button onClick={() => onSubmit()} disabled={loading} loading={loading}>
            <Icon name="save" />
            <Text className={styles.buttonText}>Save</Text>
          </Button>
        )
      }}
    />
  );
};

export default TitleForm;
