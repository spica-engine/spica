import {FluidContainer} from "oziko-ui-kit";
import React, {memo, type FC} from "react";
import styles from "./Topbar.module.scss";
import ProfilePopover from "../../molecules/profile-popover/ProfilePopover";
import {useCopyToClipboard} from "../../../hooks/useCopyToClipboard";

type TypeTopbar = {token: string; name: string; onDrawerOpen?: () => void; onProfile?: () => void; onLogout?: () => void};


const Topbar: FC<TypeTopbar> = ({token, name, onDrawerOpen, onProfile, onLogout}) => {
  const {copied, copy} = useCopyToClipboard();

  return (
    <FluidContainer
      dimensionX="fill"
      mode="fill"
      className={styles.toolbar}
      root={{
        children: (
          <>
            {token && (
              <button
                className={styles.jwtChip}
                onClick={() => copy(token)}
                title="Click to copy JWT"
              >
                <span className={styles.jwtLabel}>JWT:</span>
                <span className={styles.jwtText}>{token}</span>
                {copied ? (
                  <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                )}
              </button>
            )}
          </>
        ),
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

export default memo(Topbar);
