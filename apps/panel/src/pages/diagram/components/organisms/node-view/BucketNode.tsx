import React, { memo, type FC } from 'react'
import BucketNodeHeader from '../bucket-node-header/BucketNodeHeader';
import type { BucketType } from 'src/store/api';
import styles from './BucketNode.module.scss';
import FieldRow from '../filed-row/FieldRow';
import BucketAddField from '../../../../../components/organisms/bucket-add-field-new/BucketAddField';
import { Button, Popover } from 'oziko-ui-kit';

interface BucketNodeProps {
  bucket: BucketType;
}

const BucketNode: FC<BucketNodeProps> = ({ bucket }) => {
  return (
    <div className={styles.bucketNode}>
      <BucketNodeHeader bucket={bucket} title={bucket.title} id={bucket._id} />
      {Object.values(bucket.properties).map((field: any) => (
        <FieldRow key={field._id} field={field} bucket={{_id: bucket._id, title: bucket.title}} />
      ))}
      <BucketAddField  onSelectType={() => {}} onSaveField={() => {}} bucketId={bucket._id}>
        {({onOpen}) => (
          <Button variant="icon" onClick={onOpen}>
            Add New Field
          </Button>
        )}
      </BucketAddField>

  

    </div>
  )
}

export default memo(BucketNode)