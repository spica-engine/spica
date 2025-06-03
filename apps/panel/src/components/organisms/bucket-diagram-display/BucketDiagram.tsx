import {Button, FlexElement, FluidContainer, Icon, Text} from "oziko-ui-kit";
import React, {type FC} from "react";
import BucketSchemaList, {
  type TypeSchema
} from "../../../components/atoms/bucket-schema-list/BucketSchemaList";
import styles from "./BucketDiagram.module.scss";

type TypeBucketDiagram = {
  schema?: Record<string, TypeSchema>;
  bucketId?: string;
  bucketName?: string;
};
const BucketDiagram: FC<TypeBucketDiagram> = ({schema, bucketId, bucketName}) => {
  return (
    <>
      <FlexElement direction="vertical" dimensionX={"fill"} className={styles.topContainer}>
        <FlexElement dimensionX={"fill"} gap={10}>
          <FlexElement dimensionX={"fill"} alignment="leftCenter">
            <Text className={styles.text}> {bucketName}</Text>
          </FlexElement>
          <Button variant="icon" className={styles.topButton} onClick={() => {}}>
            <Icon name="cog" className={styles.cogButton}></Icon>
          </Button>
          <Button variant="icon" color="danger" className={styles.topButton} onClick={() => {}}>
            <Icon name="delete"></Icon>
          </Button>
        </FlexElement>
        <FlexElement dimensionX={"fill"} alignment="leftCenter" className={styles.bucketId}>
          <Text size="small" className={styles.text}>
            {bucketId}
          </Text>
        </FlexElement>
      </FlexElement>
      <FlexElement direction="vertical" className={styles.bottomContainer} dimensionX={"fill"}>
        <BucketSchemaList schema={schema} className={styles.bucketSchema} />
        <Button fullWidth variant="dashed" color="default" className={styles.newFieldButton}>
          <Icon name="plus"></Icon>
          Add New Field
        </Button>
      </FlexElement>
    </>
  );
};

export default BucketDiagram;
