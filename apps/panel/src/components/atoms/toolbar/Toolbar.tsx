import {Button, FlexElement, FluidContainer, Icon, type TypeFluidContainer} from "oziko-ui-kit";
import React, {memo, useState, type FC} from "react";
import "oziko-ui-kit/dist/index.css";
import styles from "./Toolbar.module.scss";

type TypeToolbar = {
  token: string;
  name: string;
} & TypeFluidContainer;

const Toolbar: FC<TypeToolbar> = ({token, name, ...props}) => {
  const [copied, setCopied] = useState(false);

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
    <FluidContainer
      dimensionX={"fill"}
      {...props}
      className={styles.toolbar}
      prefix={{
        children: (
          <FlexElement className={styles.flexElement} gap={10}>
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
              <Icon name={"identities"}></Icon> {/* Todo! change icon name */}
            </Button>
          </FlexElement>
        )
      }}
    />
  );
};

export default memo(Toolbar);
