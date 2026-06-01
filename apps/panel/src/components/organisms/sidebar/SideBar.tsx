import React, {type FC, useMemo, useState, useEffect} from "react";
import {useNavigate, useLocation} from "react-router-dom";
import styles from "./SideBar.module.scss";
import {Button, Icon, type IconName, createTheme} from "oziko-ui-kit";
import Logo from "../../atoms/logo/Logo";
import {getNavigationComponent} from "../../../components/prefabs/navigations/navigation-registry";
import {sideBarItems, type SideBarItem} from "../../../pages/home/sidebarItems";

const pathToSidebarId: Array<[RegExp, string]> = [
  [/^\/bucket/, "bucket"],
  [/^\/function/, "function"],
  [/^\/passport\/observability/, "observability"],
  [/^\/activity/, "observability"],
  [/^\/passport/, "accessManagement"],
  [/^\/config/, "config"],
  [/^\/webhook/, "webhook"],
  [/^\/storage/, "storage"],
  [/^\/version-control/, "versionControl"],
  [/^\/dashboard/, "dashboard"],
];

const getActiveItemFromPath = (pathname: string): SideBarItem => {
  for (const [pattern, id] of pathToSidebarId) {
    if (pattern.test(pathname)) {
      const found = sideBarItems.find(i => i.id === id);
      if (found) return found;
    }
  }
  return sideBarItems.find(i => !i.separator) ?? sideBarItems[0];
};

type TypeSideBar = {
  toggleIconName?: IconName;
  onNavigatorToggle?: (isOpen: boolean) => void;
  inDrawer?: boolean;
};

const railSvgMap: Record<string, React.ReactElement> = {
  dashboard: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  bucket: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
      <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/>
    </svg>
  ),
  function: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
    </svg>
  ),
  accessManagement: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87m-4-12a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  config: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  webhook: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/>
      <line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/>
    </svg>
  ),
  storage: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
    </svg>
  ),
  versionControl: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
      <line x1="6" y1="9" x2="6" y2="15"/><path d="M18 15V9a3 3 0 0 0-3-3H9"/>
    </svg>
  ),
  themeSun: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  ),
  themeMoon: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  ),
};

const SideBar: FC<TypeSideBar> = ({
  toggleIconName = "chevronLeft",
  onNavigatorToggle,
  inDrawer = false
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showNavigator, setShowNavigator] = useState(true);
  const [activeSideBarItem, setActiveSideBarItem] = useState<SideBarItem>(
    () => getActiveItemFromPath(location.pathname)
  );
  const [isDark, setIsDark] = useState<boolean>(
    () => localStorage.getItem("themeMode") === "dark"
  );

  useEffect(() => {
    createTheme({palette: {mode: isDark ? "dark" : "light"}});
  }, []);

  useEffect(() => {
    setActiveSideBarItem(getActiveItemFromPath(location.pathname));
  }, [location.pathname]);

  const {mainItems, bottomItems} = useMemo(() => {
    const main: SideBarItem[] = [];
    const bottom: SideBarItem[] = [];
    for (const item of sideBarItems) {
      if (item.position === "bottom") {
        bottom.push(item);
      } else {
        main.push(item);
      }
    }
    return {mainItems: main, bottomItems: bottom};
  }, []);

  const handleItemClick = (item: SideBarItem) => {
    setShowNavigator(true);
    setActiveSideBarItem(item);
    if (item.route) {
      navigate(item.route);
    }
  };

  const toggleNavigator = () => {
    setShowNavigator(prev => {
      const newState = !prev;
      onNavigatorToggle?.(newState);
      return newState;
    });
  };

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    const mode = newIsDark ? "dark" : "light";
    localStorage.setItem("themeMode", mode);
    createTheme({palette: {mode}});
  };

  const NavigationComponent = activeSideBarItem
    ? getNavigationComponent(activeSideBarItem.id)
    : null;

  return (
    <div className={`${styles.container} ${inDrawer ? styles.inDrawer : ""}`}>
      <div className={styles.menuContainer}>
        <div className={styles.logo}>
          <Logo />
        </div>

        <div className={styles.menu}>
          {mainItems.map((item) => {
            if (item.separator) {
              return <div key={item.id} className={styles.separator} />;
            }
            const isActive = activeSideBarItem.id === item.id;
            return (
              <button
                key={item.id}
                title={item.name}
                className={`${styles.menuItem} ${isActive ? styles.active : ""}`}
                onClick={() => handleItemClick(item)}
              >
                {railSvgMap[item.id] ?? <Icon name={item.icon} size="md" />}
              </button>
            );
          })}
          <button className={styles.menuItem} title="Toggle navigator" onClick={toggleNavigator}>
            <Icon name={toggleIconName} size="md" />
          </button>
        </div>

        <button
          className={styles.menuItem}
          title={isDark ? "Switch to Light" : "Switch to Dark"}
          onClick={toggleTheme}
        >
          {isDark ? railSvgMap.themeSun : railSvgMap.themeMoon}
        </button>

        {bottomItems.map((item) => {
          const isActive = activeSideBarItem.id === item.id;
          return (
            <Button
              variant="icon"
              key={item.id}
              className={`${styles.menuItem} ${isActive ? styles.active : ""}`}
              onClick={() => handleItemClick(item)}
            >
              {railSvgMap[item.id] ?? <Icon name={item.icon} size="md" />}
            </Button>
          );
        })}
      </div>

      {showNavigator && NavigationComponent && (
        <NavigationComponent
          menuItem={activeSideBarItem}
        />
      )}
    </div>
  );
};

export default SideBar;
