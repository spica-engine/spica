import {memo, useState} from "react";
import styles from "./Identity.module.scss";
import useLocalStorage from "../../hooks/useLocalStorage";
import {Button, FlexElement, Icon} from "oziko-ui-kit";

const Identity = () => {
  const [copied, setCopied] = useState(false);
  const [token] = useLocalStorage<string>("token", "");

  const handleCopy = () => {
    navigator.clipboard
      .writeText(token)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1000);
      })
      .catch(err => {
        console.error("Failed to copy token:", err);
      });
  };

  return (
          <FlexElement className={styles.container} gap={10}>
      <span className={styles.tokenText}>{token}</span>
      <Button
        variant="icon"
        shape="circle"
        className={styles.tokenButton}
        onClick={handleCopy}
      >
        <Icon name={copied ? "check" : "contentCopy"} />
      </Button>
    </FlexElement>
  );
};

export default memo(Identity);
