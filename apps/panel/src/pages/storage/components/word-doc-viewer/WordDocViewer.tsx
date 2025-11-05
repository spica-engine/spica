import {renderAsync} from "docx-preview";
import {useRef, useEffect, useState} from "react";
import styles from "./WordDocViewer.module.scss";

type WordDocViewerProps = {
  url: string;
  token?: string | null;
} & React.HTMLAttributes<HTMLDivElement>;

export const WordDocViewer = ({url, token, ...props}: WordDocViewerProps) => {
  const [isError, setIsError] = useState(false);

  const viewerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let isCancelled = false;

    const fetchDocx = async () => {
      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Accept:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/msword",
            ...(token ? {Authorization: `IDENTITY ${token}`} : {})
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to load: ${url} (Status: ${response.status})`);
        }

        const arrayBuffer = await response.arrayBuffer();

        if (arrayBuffer.byteLength === 0) {
          throw new Error("Received empty file");
        }

        const uint8Array = new Uint8Array(arrayBuffer);
        const signature = uint8Array.slice(0, 4);

        const isValidZip =
          signature[0] === 0x50 &&
          signature[1] === 0x4b &&
          signature[2] === 0x03 &&
          signature[3] === 0x04;

        if (!isValidZip) {
          throw new Error("Invalid .docx file format (not a valid ZIP archive)");
        }

        if (!isCancelled && viewerRef.current) {
          viewerRef.current.innerHTML = "";
          await renderAsync(arrayBuffer, viewerRef.current);
        }
      } catch (error) {
        console.error("Failed to render docx:", error);
        if (!isCancelled && viewerRef.current) {
          viewerRef.current.innerHTML = `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">Failed to load document: ${error instanceof Error ? error.message : "Unknown error"}</div>`;
        }
        setIsError(true);
      }
    };

    fetchDocx();

    return () => {
      isCancelled = true;
    };
  }, [url]);

  return (
    <div {...props} className={`${styles.viewerContainer} ${props.className || ""} ${isError ? styles.error : "" }`}>
      <div ref={viewerRef} className={styles.viewer} />
    </div>
  );
};
