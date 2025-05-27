import {
  Button,
  Icon,
  Modal,
  type TypeModal,
  type TypeModalBody,
  type TypeModalFooter,
  type TypeModalHeader
} from "oziko-ui-kit";
import React, {memo, type FC} from "react";
import styles from "./ModalLayout.module.scss";
type TypeModalLayout = {
  title?: string;
  children?: React.ReactNode;
  onClose?: () => void;
  onSave?: () => void;
  headerProps: TypeModalHeader;
  bodyProps: TypeModalBody;
  footerProps: TypeModalFooter;
} & TypeModal;

const ModalLayout: FC<TypeModalLayout> = ({
  title,
  children,
  onClose,
  onSave,
  headerProps,
  bodyProps,
  footerProps,
  ...props
}) => {
  return (
    <Modal
      showCloseButton={false}
      onClose={onClose}
      {...props}
      className={`${styles.modal} ${props.className || ""}`}
    >
      <Modal.Header
        prefix={{
          children: <span className={styles.title}>{title}</span>
        }}
        {...headerProps}
        className={`${styles.header} ${headerProps.className || ""}`}
      />
      <Modal.Body {...bodyProps}>{children}</Modal.Body>
      <Modal.Footer
        dimensionX={"fill"}
        alignment="rightCenter"
        {...footerProps}
        className={`${styles.footer} ${footerProps.className || ""}`}
        suffix={{
          children: (
            <Button color="default" onClick={onSave} className={`${styles.closeButton}`}>
              <Icon name="save" size="lg"></Icon>
              Save
            </Button>
          )
        }}
      ></Modal.Footer>
    </Modal>
  );
};

export default memo(ModalLayout);
