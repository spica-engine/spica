import {Button, FlexElement, FluidContainer, Icon} from "oziko-ui-kit";
import React, {memo, useState, type FC} from "react";
import styles from "./Toolbar.module.scss";

type TypeToolbar = {
  token: string | null;
  name: string | null;
  onDrawerOpen?: () => void;
};

const Toolbar: FC<TypeToolbar> = ({token, name, onDrawerOpen}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!token) return;
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
    <FluidContainer
      dimensionX="fill"
      className={styles.toolbar}
      prefix={{
        children: (
          <FlexElement className={styles.flexElement} gap={10}>
            <Button
              variant="icon"
              shape="circle"
              onClick={onDrawerOpen}
              className={styles.menuButton}
            >
              <Icon name="sort" />
            </Button>

            <span className={styles.text}>{token}</span>
            <Button
              variant="icon"
              shape="circle"
              className={`${styles.button} ${styles.tokenButton}`}
              onClick={handleCopy}
            >
              <Icon name={copied ? "check" : "contentCopy"} />
            </Button>
          </FlexElement>
        )
      }}
      root={{
        children: (
          <FlexElement className={styles.flexElement} gap={10}>
            <span className={styles.text}>{name}</span>
            <Button variant="icon" shape="circle" className={styles.button} onClick={() => {}}>
              <Icon name="person" />
            </Button>
          </FlexElement>
        )
      }}
    />
  );
};

export default memo(Toolbar);
