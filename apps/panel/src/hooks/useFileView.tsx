import {Icon, Spinner, type TypeFile} from "oziko-ui-kit";
import type {CSSProperties} from "react";
import {memo, useEffect, useRef, useState} from "react";
import {renderAsync} from "docx-preview";
import React, {useMemo} from "react";

type TypeStyle = {
  image?: CSSProperties;
  video?: CSSProperties;
  text?: CSSProperties;
  doc?: CSSProperties;
  pdf?: CSSProperties;
};

type TypeClassName = {
  image?: string;
  video?: string;
  text?: string;
  doc?: string;
  spreadsheet?: string;
  pdf?: string;
  zip?: string;
};

type TypeUseFileView = {
  file?: TypeFile;
  styles?: TypeStyle;
  classNames?: TypeClassName;
  isLoading?: boolean;
};

interface WordDocProps {
  url: string;
  className?: string;
}

const WordDocViewer = ({url, className}: WordDocProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let isCancelled = false;

    (async () => {
      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Accept:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/msword"
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

        if (!isCancelled && containerRef.current) {
          containerRef.current.innerHTML = "";
          await renderAsync(arrayBuffer, containerRef.current);
        }
      } catch (error) {
        console.error("Failed to render docx:", error);
        if (!isCancelled && containerRef.current) {
          containerRef.current.innerHTML = `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">Failed to load document: ${error instanceof Error ? error.message : "Unknown error"}</div>`;
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [url]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{display: "flex", justifyContent: "center", alignItems: "center"}}
    />
  );
};

interface TextViewerProps {
  fileUrl: string;
  style?: CSSProperties;
  className?: string;
  height?: string | number;
}

/**
 * NOTE: This component has been manually tested with sample text files.
 * Expected behavior confirmed: files render correctly with no visible issues.
 * ⚠️ Review by a security-experienced developer is recommended
 * before using with sensitive or untrusted content.
 */
const TextViewer: React.FC<TextViewerProps> = ({fileUrl, style, className, height = 400}) => {
  const [iframeSrc, setIframeSrc] = React.useState<string>("");

  const escapeHtml = (str: string) =>
    str.replace(
      /[&<>"']/g,
      s =>
        (
          ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}) as Record<
            string,
            string
          >
        )[s]
    );

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error("Failed to load file");
        const text = await res.text();

        if (cancelled) return;

        const escaped = escapeHtml(text);
        const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <!-- Tighten CSP: no inline scripts allowed -->
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; connect-src 'none';">
    <meta http-equiv="X-Content-Type-Options" content="nosniff">
    <style>
      body { background: white; color: black; font-family: monospace; padding: 1rem; margin: 0; }
      pre { white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere; margin: 0; }
    </style>
  </head>
  <body><pre>${escaped}</pre></body>
</html>`;

        const blob = new Blob([html], {type: "text/html"});
        const url = URL.createObjectURL(blob);
        setIframeSrc(url);
      } catch (err) {
        const errorHtml = `<!DOCTYPE html><html><body style="display:flex;align-items:center;justify-content:center;height:100%;">Failed to load file content</body></html>`;
        const blob = new Blob([errorHtml], {type: "text/html"});
        setIframeSrc(URL.createObjectURL(blob));
        console.error("TextViewer fetch error:", err);
      }
    })();

    return () => {
      cancelled = true;
      if (iframeSrc && iframeSrc.startsWith("blob:")) {
        URL.revokeObjectURL(iframeSrc);
      }
    };
  }, [fileUrl]);

  if (!iframeSrc) return null;
  return (
    <iframe
      src={iframeSrc}
      width="100%"
      height={height}
      style={{border: "none", ...(style || {})}}
      className={className}
      sandbox=""
      referrerPolicy="no-referrer"
      title="Text file viewer"
    />
  );
};

const createImageUrl = (fileUrl: string) => {
  const url = new URL(fileUrl);
  url.searchParams.set("t", String(Date.now()));
  return url.toString();
};

const ImageViewer = ({
  file,
  style,
  className,
  loading: externalLoading
}: {
  file: TypeFile;
  style?: CSSProperties;
  className?: string;
  loading?: boolean;
}) => {
  const [isImageLoading, setIsImageLoading] = useState(true);

  if (!file.content.type.startsWith("image/")) return null;

  const loading = Boolean(externalLoading) || isImageLoading;
  const imageUrl = createImageUrl(file.url);

  return (
    <div style={{position: "relative", display: "inline-block"}}>
      {loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none"
          }}
        >
          <Spinner />
        </div>
      )}
      <img
        key={imageUrl}
        src={imageUrl}
        alt={file.name}
        style={{...(style || {}), display: loading ? "none" : "block"}}
        className={className}
        onLoad={() => setIsImageLoading(false)}
        onError={() => setIsImageLoading(false)}
      />
    </div>
  );
};

const useFileView = ({file, styles, classNames, isLoading}: TypeUseFileView) => {
  if (!file) {
    return null;
  }

  const contentTypeMapping = [
    {
      regex: /^image\//,
      viewer: (file: TypeFile, loading: boolean) => <ImageViewer key={file.url} file={file} loading={loading} />
    },
    {
      regex: /^video\//,
      viewer: (file: TypeFile) => (
        <video controls style={styles?.video} className={classNames?.video}>
          <source src={file.url} type={file.content.type} />
          Your browser does not support the video tag.
        </video>
      )
    },
    {
      regex: /^(text\/plain|text\/javascript|application\/json)$/,
      viewer: (file: TypeFile) => (
        <TextViewer
          fileUrl={file.url}
          height={styles?.text?.height || 400}
          style={styles?.text}
          className={classNames?.text}
        />
      )
    },
    {
      regex:
        /^(application\/msword|application\/vnd.openxmlformats-officedocument.wordprocessingml.document)$/,
      viewer: (file: TypeFile) => <WordDocViewer url={file.url} className={classNames?.doc} />
    },
    {
      regex: /^(application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|text\/csv)$/,
      viewer: () => <Icon name="gridOn" size={72} className={classNames?.spreadsheet} />
    },
    {
      regex: /^application\/pdf/,
      viewer: (file: TypeFile) => {
        const url = new URL(file.url);
        url.search = "";
        return (
          <embed
            type={file.content.type}
            src={url.toString()}
            style={styles?.pdf}
            className={classNames?.pdf}
          />
        );
      }
    },
    {
      regex: /^application\/zip/,
      viewer: () => <Icon name="folderZip" size={72} className={classNames?.zip} />
    }
  ];

  const match = contentTypeMapping.find(({regex}) => regex.test(file.content.type));

  if (match) {
    return match.viewer(file, isLoading || false);
  }

  return <Icon name="fileDocument" size={72} />;
};

export default useFileView;
