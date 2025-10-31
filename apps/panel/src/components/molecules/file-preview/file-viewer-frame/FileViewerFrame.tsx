import {FlexElement, Button, Icon} from "oziko-ui-kit";
import styles from "./FileViewer.module.scss";

interface FileViewerFrameProps {
  children: React.ReactNode;
  onClose: () => void;
}

export const FileViewerFrame = ({children, onClose}: FileViewerFrameProps) => {
  return (
    <FlexElement gap={10} direction="vertical" className={styles.viewerFrame}>
      <FlexElement gap={10} dimensionX="fill" alignment="rightCenter">
        <Button className={styles.closePreviewButton} variant="icon" onClick={onClose}>
          <Icon name="close" />
        </Button>
      </FlexElement>
      <FlexElement className={styles.fileView}>{children}</FlexElement>
    </FlexElement>
  );
};
