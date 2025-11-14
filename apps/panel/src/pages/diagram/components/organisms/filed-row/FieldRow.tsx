// @owner Kanan Gasimov

import React, { memo, type FC } from 'react'

import styles from './FieldRow.module.scss';
import { Button, Icon } from 'oziko-ui-kit';
import DeleteField from '../../../../../components/prefabs/delete-field/DeleteField';
import EditField from '../../../../../components/prefabs/edit-field/EditField';
import NewEditField from "../../../../../components/organisms/edit-field/EditField"
import type { FieldConfig } from '../../../../../components/organisms/edit-field/types';

interface FieldRowProps {
  field: any & {isPrimary: boolean};
  bucket: {_id: string; title: string};
}

const FieldRow: FC<FieldRowProps> = ({ field, bucket }) => {
  const handleSaveField = (updatedField: FieldConfig) => {
  };

  return (
    <div className={styles.fieldRow}>
        <div className={styles.fieldLeft}>
            <span className={styles.fieldName}>{field.title}</span>
            <span className={styles.fieldType}>{field.type}</span>
        </div>
        <div className={styles.fieldControls}>
        <NewEditField 
              field={field as FieldConfig} 
              onSave={handleSaveField} 
            />
            <EditField field={field}>
                {({onOpen}) => (
                    <Button variant="icon" className={styles.editButton} onClick={onOpen}>
                        <Icon name="pencil" />
                    </Button>
                )}
            </EditField>
            {!field.isPrimary && (
                  <DeleteField field={field} bucket={{_id: bucket._id, title: bucket.title}}>
                    {({onOpen}) => (
                      <Button variant="icon" className={styles.deleteButton} onClick={onOpen}>
                        <Icon name="delete" />
                      </Button>
                    )}
                  </DeleteField>
                )}
        </div>
    </div>
  )
}

export default memo(FieldRow)