import {FlexElement, Text} from "oziko-ui-kit";
import styles from "./FileMetada.module.scss";
import type {DirectoryItem} from "src/types/storage";
import {useMemo} from "react";

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, unitIndex);

  return `${parseFloat(value.toFixed(2))} ${units[unitIndex]}`;
}

interface FileMetadataProps {
  file: DirectoryItem;
  timestamp: number;
}

export const FileMetadata = ({file, timestamp}: FileMetadataProps) => {
  const createdAt = useMemo(
    () =>
      new Date(timestamp).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
      }),
    [timestamp]
  );

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
