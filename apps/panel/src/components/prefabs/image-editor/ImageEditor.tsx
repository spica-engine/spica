import {Button, Modal} from "oziko-ui-kit";
import {useEffect, useRef, useState} from "react";
import type {CSSProperties} from "react";
import "tui-image-editor/dist/tui-image-editor.css";
import styles from "./ImageEditor.module.scss";

type EditorInstance = {
  destroy: () => void;
  loadImageFromURL: (url: string, name?: string) => Promise<unknown>;
  toDataURL: (options?: {format?: string; quality?: number}) => string;
};

type SavePayload = {
  blob: Blob;
  dataURL: string;
  editor: EditorInstance;
};

type MenuBarPosition = "bottom" | "left";

interface ImageEditor2Props {
  imageUrl?: string;
  imageName?: string;
  cssMaxWidth?: number;
  cssMaxHeight?: number;
  initMenu?: string;
  menuBarPosition?: MenuBarPosition;
  selectionCornerSize?: number;
  className?: string;
  style?: CSSProperties;
  onReady?: (editor: EditorInstance) => void;
  onSave?: (payload: SavePayload) => Promise<void> | void;
  isOpen?: boolean;
  onClose?: () => void;
}

const DEFAULT_IMAGE_URL = "img/sampleImage.jpg";
const DEFAULT_IMAGE_NAME = "SampleImage";

const whiteTheme = {
  "header.display": "none",
  "common.backgroundColor": "#fff",

} as const;

const dataURLToBlob = async (dataURL: string): Promise<Blob> => {
  const response = await fetch(dataURL);
  return response.blob();
};

const ImageEditor = ({
  imageUrl = DEFAULT_IMAGE_URL,
  imageName = DEFAULT_IMAGE_NAME,
  cssMaxWidth = 700,
  cssMaxHeight = 500,
  initMenu = "filter",
  menuBarPosition = "bottom",
  selectionCornerSize = 20,
  className,
  style,
  onReady,
  onSave,
  isOpen = false,
  onClose
}: ImageEditor2Props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<EditorInstance | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (globalThis.window === undefined) {
      return;
    }

    let isMounted = true;
    const initEditor = async () => {
      if (!containerRef.current) return;

      const {default: TuiImageEditor} = await import("tui-image-editor");

      if (!isMounted || !containerRef.current) return;

      const instance = new TuiImageEditor(containerRef.current, {
        includeUI: {
          loadImage: {
            path: imageUrl,
            name: imageName
          },
          theme: whiteTheme,
          initMenu,
          menuBarPosition
        },
        cssMaxWidth,
        cssMaxHeight,
        selectionStyle: {
          cornerSize: selectionCornerSize,
          rotatingPointOffset: 70
        },
        usageStatistics: false
      }) as unknown as EditorInstance;

      editorRef.current = instance;
      onReady?.(instance);

      if (imageUrl) {
        try {
          await instance.loadImageFromURL(imageUrl, imageName);
        } catch {
          // ignore load errors for now; editor UI is still usable
        }
      }
    };

    initEditor();

    return () => {
      isMounted = false;
      editorRef.current?.destroy();
      editorRef.current = null;
    };
  }, [
    cssMaxHeight,
    cssMaxWidth,
    imageName,
    imageUrl,
    initMenu,
    menuBarPosition,
    onReady,
    selectionCornerSize
  ]);

  const handleSave = async () => {
    if (!editorRef.current) {
      onClose?.();
      return;
    }

    setIsSaving(true);
    const editor = editorRef.current;

    try {
      const dataURL = editor.toDataURL();
      const blob = await dataURLToBlob(dataURL);
      await onSave?.({blob, dataURL, editor});
    } catch (error) {
      console.error("Failed to prepare edited image:", error);
    } finally {
      setIsSaving(false);
      onClose?.();
      editor.destroy();
      editorRef.current = null;
    }
  };

  return (
    <Modal
      animation="growFromCenter"
      isOpen={isOpen}
      onClose={onClose}
      showCloseButton={false}
      className={styles.imageEditorModal}
      gap={0}
    >

      <div
        id="tui-image-editor"
        ref={containerRef}
        className={styles.imageEditorContainer}
        style={style}
      />
      <Button
        onClick={handleSave}
        disabled={isSaving}
        className={styles.saveButton}
      >
        {isSaving ? "Saving..." : "Save"}
      </Button>

    </Modal>
  );
};

export default ImageEditor;
