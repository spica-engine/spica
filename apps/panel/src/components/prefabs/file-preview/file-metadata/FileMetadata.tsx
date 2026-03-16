/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */
 

import {FlexElement, Text} from "oziko-ui-kit";
import styles from "./FileMetada.module.scss";
import type {DirectoryItem} from "src/types/storage";
import {useMemo} from "react";
import {formatFileSize, formatDate} from "../utils";

interface FileMetadataProps {
  file: DirectoryItem;
  timestamp: number;
}

export const FileMetadata = ({file, timestamp}: FileMetadataProps) => {
  const createdAt = useMemo(() => formatDate(timestamp), [timestamp]);

  return (
    <FlexElement direction="vertical" gap={10}>
      <Text className={styles.metadataName}>{file?.label}</Text>
      <Text>
        {file?.content?.type} - {formatFileSize(file?.content?.size || 0)}
      </Text>
      <Text>{createdAt}</Text>
    </FlexElement>
  );
};
