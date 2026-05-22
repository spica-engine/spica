import {Popover} from "oziko-ui-kit";
import React, {memo, useState, type FC} from "react";
import styles from "./ProfilePopover.module.scss";

type TypeProfilePopover = {
  name?: string;
  email?: string;
  profileOnClick?: () => void;
  settingsOnClick?: () => void;
  logoutOnClick?: () => void;
};

function formatDisplayName(name?: string, email?: string) {
  const normalizedName = name?.trim();
  if (normalizedName && normalizedName !== email) {
    if (!normalizedName.includes("@")) {
      return normalizedName;
    }

    const [localPart] = normalizedName.split("@");
    return localPart.replace(/[._-]+/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
  }

  const normalizedEmail = email?.trim();
  if (normalizedEmail) {
    const [localPart] = normalizedEmail.split("@");
    return localPart.replace(/[._-]+/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
  }

  return "Spica Admin";
}

function getAvatarLabel(value: string) {
  const firstCharacter = value.trim().charAt(0);
  return firstCharacter ? firstCharacter.toUpperCase() : "S";
}

const ProfilePopover: FC<TypeProfilePopover> = ({
  name,
  email,
  profileOnClick = () => {},
  settingsOnClick = () => {},
  logoutOnClick = () => {}
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const displayName = formatDisplayName(name, email);
  const displayEmail = email?.trim() || name?.trim() || "";
  const avatarLabel = getAvatarLabel(displayName);

  const closeMenu = () => setIsOpen(false);
  const toggleMenu = () => setIsOpen(open => !open);

  return (
    <Popover
      open={isOpen}
      onClose={closeMenu}
      contentProps={{className: styles.popoverContainer}}
      content={
        <div className={styles.userMenu}>
          <div className={styles.userHeader}>
            <div className={styles.userAvatar}>{avatarLabel}</div>
            <div className={styles.userMeta}>
              <div className={styles.userName}>{displayName}</div>
              {displayEmail ? <div className={styles.userEmail}>{displayEmail}</div> : null}
            </div>
          </div>

          <div className={styles.divider} />

          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              closeMenu();
              profileOnClick();
            }}
          >
            <span className={styles.itemIcon}>
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </span>
            <span>Profile</span>
          </button>

          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              closeMenu();
              settingsOnClick();
            }}
          >
            <span className={styles.itemIcon}>
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </span>
            <span>Settings</span>
          </button>

          <div className={styles.divider} />

          <button
            type="button"
            className={`${styles.menuItem} ${styles.danger}`}
            onClick={() => {
              closeMenu();
              logoutOnClick();
            }}
          >
            <span className={styles.itemIcon}>
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </span>
            <span>Logout</span>
          </button>
        </div>
      }
    >
      <button
        type="button"
        aria-label="Open user menu"
        aria-expanded={isOpen}
        className={`${styles.userButton}${isOpen ? ` ${styles.buttonOpen}` : ""}`}
        onClick={toggleMenu}
      >
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </button>
    </Popover>
  );
};

export default memo(ProfilePopover);
