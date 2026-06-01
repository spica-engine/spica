import {FluidContainer} from "oziko-ui-kit";
import React, {memo, type FC} from "react";
import styles from "./Topbar.module.scss";
import ProfilePopover from "../../molecules/profile-popover/ProfilePopover";
import {useCopyToClipboard} from "../../../hooks/useCopyToClipboard";

type TypeTopbar = {
  token: string;
  name: string;
  email?: string;
  onDrawerOpen?: () => void;
  onProfile?: () => void;
  onSettings?: () => void;
  onLogout?: () => void;
};


const Topbar: FC<TypeTopbar> = ({token, name, email, onDrawerOpen, onProfile, onSettings, onLogout}) => {
  const {copied, copy} = useCopyToClipboard();

  return (
    <FluidContainer
      dimensionX="fill"
      mode="fill"
      className={styles.toolbar}
      root={{
        children: (
          <>
            <button
              className={styles.hamburger}
              onClick={onDrawerOpen}
              title="Open menu"
            >
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
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
              name={name}
              email={email}
              profileOnClick={onProfile}
              settingsOnClick={onSettings}
              logoutOnClick={onLogout}
            />

        )
      }}
    />
  );
};

export default memo(Topbar);
