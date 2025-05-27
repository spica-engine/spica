import React, {createContext, useContext, useState, useEffect, useCallback} from "react";

type UIContextType = {
  isSmallScreen: boolean;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
};

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [isSmallScreen, setIsSmallScreen] = useState(window.innerWidth < 1280);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleResize = useCallback(() => {
    const isNowSmall = window.innerWidth < 1280;
    setIsSmallScreen(isNowSmall);

    // Close drawer if screen size increases
    if (!isNowSmall) setIsDrawerOpen(false);
  }, []);

  useEffect(() => {
    window.addEventListener("resize", handleResize);
    handleResize(); // Initial check

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [handleResize]);

  const openDrawer = () => setIsDrawerOpen(true);
  const closeDrawer = () => setIsDrawerOpen(false);

  return (
    <UIContext.Provider value={{isSmallScreen, isDrawerOpen, openDrawer, closeDrawer}}>
      {children}
    </UIContext.Provider>
  );
};

export const useUIContext = (): UIContextType => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error("useUIContext must be used within a UIProvider");
  }
  return context;
};
