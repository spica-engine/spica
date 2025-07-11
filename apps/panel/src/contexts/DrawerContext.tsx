import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import DrawerShell from "../components/organisms/drawer-shell/DrawerShell";
import type {TypeDrawer} from "oziko-ui-kit";

type DrawerOpenOptions = Omit<TypeDrawer, "placement" | "isOpen" | "onClose"> & {
  placement?: TypeDrawer["placement"];
};

type DrawerRenderProps = Omit<TypeDrawer, "isOpen" | "onClose">;

type DrawerContextType = {
  isOpen: boolean;
  openDrawer: (newContent: ReactNode, drawerProps?: DrawerOpenOptions) => void;
  closeDrawer: () => void;
  content: ReactNode | null;
};

const DrawerContext = createContext<DrawerContextType | null>(null);

export const DrawerProvider = ({children}: {children: ReactNode}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState<ReactNode | null>(null);
  const [drawerProps, setDrawerProps] = useState<DrawerRenderProps>({placement: "right"});

  const closeDrawer = useCallback(() => {
    setIsOpen(false);
    setContent(null);
  }, []);

  const openDrawer = useCallback((newContent: ReactNode, newDrawerProps?: DrawerOpenOptions) => {
    if (isOpen) closeDrawer();
    if (newDrawerProps)
      setDrawerProps({...newDrawerProps, placement: newDrawerProps.placement || "right"});
    setContent(newContent);
    setIsOpen(true);
  }, []);

  useEffect(() => {
    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") closeDrawer();
    }

    window.addEventListener("keydown", handleEsc);

    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const contextValue = useMemo(
    () => ({
      isOpen,
      openDrawer,
      closeDrawer,
      content
    }),
    [isOpen, content]
  );

  return (
    <DrawerContext.Provider value={contextValue}>
      {children}
      <DrawerShell {...drawerProps} onClose={closeDrawer} isOpen={isOpen}>
        {content}
      </DrawerShell>
    </DrawerContext.Provider>
  );
};

export function useDrawerController() {
  const context = useContext(DrawerContext);

  if (!context) throw new Error("useDrawerController must be used within an DrawerProvider");
  return context;
}

export default DrawerContext;
