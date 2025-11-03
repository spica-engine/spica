// @owner Kanan Gasimov


import { Button, Icon } from 'oziko-ui-kit';
import { memo, type FC } from 'react'
import styles from './BucketNodeHeader.module.scss';
import DeleteBucket from '../../../../../components/prefabs/delete-bucket/DeleteBucket';
import EditBucket from '../../../../../components/prefabs/edit-bucket/EditBucket';
import type { BucketType } from 'src/store/api';

interface BucketNodeHeaderProps { 
    bucket: BucketType; // TODO: after updating EditBucket remove this props and use only id and title
    title: string;
    id: string;
}

const BucketNodeHeader: FC<BucketNodeHeaderProps> = ({ title, id, bucket }) => {
  return (
    <div className={styles.bucketNodeHeader}>
        <h3>{title}</h3>
        <p>{id}</p>
        <EditBucket bucket={bucket}>
              {({onOpen}) => (
                <Button variant="icon" className={styles.settingsButton} onClick={onOpen}>
                  <Icon name="cog" />
                </Button>
              )}
            </EditBucket>
        <DeleteBucket bucket={{_id: id, title}}>
              {({onOpen}) => (
                <Button variant="icon" className={styles.deleteButton} onClick={onOpen}>
                  <Icon name="delete" />
                </Button>
              )}
            </DeleteBucket>
    </div>
  )
}

export default memo(BucketNodeHeader)