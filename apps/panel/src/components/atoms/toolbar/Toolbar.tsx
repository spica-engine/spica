import {Button, FlexElement, FluidContainer, Icon} from "oziko-ui-kit";
import React, {memo, useState, type FC} from "react";
import styles from "./Toolbar.module.scss";
import {useUIContext} from "../../../context/UIContext";

type TypeToolbar = {
  token: string;
  name: string;
};

const Toolbar: FC<TypeToolbar> = ({token, name}) => {
  const [copied, setCopied] = useState(false);
  const {isSmallScreen, openDrawer} = useUIContext();

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
      className={styles.toolbar}
      prefix={{
        children: (
          <FlexElement className={styles.flexElement} gap={10}>
            {isSmallScreen && (
              <Button
                variant="icon"
                shape="circle"
                onClick={openDrawer}
                className={`${styles.menuButton}`}
              >
                <Icon name="sort" />
              </Button>
            )}
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
