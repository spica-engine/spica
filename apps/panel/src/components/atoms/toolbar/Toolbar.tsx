import {Button, FlexElement, FluidContainer, Icon} from "oziko-ui-kit";
import React, {memo, useState, type FC} from "react";
import styles from "./Toolbar.module.scss";

const name = "Spica";
const jwt = "PlaceholderJWT123";

const Toolbar = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard
      .writeText(jwt)
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
      dimensionX={"fill"}
      className={styles.toolbar}
      prefix={{
        children: (
          <FlexElement className={styles.flexElement} gap={10}>
            <span className={styles.text}>{jwt}</span>
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
              <Icon name={"identities"}></Icon> {/* Todo! change icon name */}
            </Button>
          </FlexElement>
        )
      }}
    />
  );
};

export default memo(Toolbar);
