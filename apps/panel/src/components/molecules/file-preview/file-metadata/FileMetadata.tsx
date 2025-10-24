import {FlexElement, Text} from "oziko-ui-kit";
import styles from "./FilePreview.module.scss";

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);

  return `${parseFloat(value.toFixed(2))} ${units[i]}`;
}

interface FileMetadataProps {
  name?: string;
  type?: string;
  size?: number;
  createdAt: string;
}

export const FileMetadata = ({name, type, size, createdAt}: FileMetadataProps) => {
  return (
    <FlexElement direction="vertical" gap={10}>
      <Text className={styles.metadataName}>{name}</Text>
      <Text>
        {type} - {formatFileSize(size || 0)}
      </Text>
      <Text>{createdAt}</Text>
    </FlexElement>
  );
};
