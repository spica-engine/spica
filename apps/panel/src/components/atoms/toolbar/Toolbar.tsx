import {Button, FlexElement, FluidContainer, Icon} from "oziko-ui-kit";
import React, {memo, type FC} from "react";
import styles from "./Toolbar.module.scss";
import ProfilePopover from "../../molecules/profile-popover/ProfilePopover";
import {useCopyToClipboard} from "../../../hooks/useCopyToClipboard";

type TypeToolbar = {token: string; name: string; onDrawerOpen?: () => void; onProfile?: () => void; onLogout?: () => void};


const Toolbar: FC<TypeToolbar> = ({token, name, onDrawerOpen, onProfile, onLogout}) => {
  const {copied, copy} = useCopyToClipboard();

  return (
    <FluidContainer
      dimensionX="fill"
      mode="fill"
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
          
          </FlexElement>
        )
      }}

      root={{
        children: (<>
          {token && (
              <>
                <span>JWT: </span>
                <span className={styles.text}>{token}</span>
                <Button
                  variant="icon"
                  shape="circle"
                  className={`${styles.button} ${styles.tokenButton}`}
                  onClick={() => copy(token)}
                >
                  <Icon name={copied ? "check" : "contentCopy"} />
                </Button>
              </>
            )}
        </>),
        dimensionX: "fill",
        alignment: "leftCenter"
      }}
      suffix={{
        children: (
            <ProfilePopover
              profileOnClick={onProfile}
              logoutOnClick={onLogout}
            />

        )
      }}
    />
  );
};

export default memo(Toolbar);
