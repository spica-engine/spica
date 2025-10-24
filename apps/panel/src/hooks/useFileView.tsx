import {Icon, type TypeFile, Text, Spinner} from "oziko-ui-kit";
import type {CSSProperties} from "react";
import {useEffect, useRef, useState} from "react";
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

interface SafeVideoPlayerProps {
  url: string;
  mimeType?: string;
  style?: CSSProperties;
  className?: string;
}

interface SafeVideoPlayerProps {
  url: string;
  style?: React.CSSProperties;
  className?: string;
}

export function SafeVideoPlayer({url, style, className}: SafeVideoPlayerProps) {
  const [canPlay, setCanPlay] = useState<boolean | null>(null);

  useEffect(() => {
    if (!url) {
      setCanPlay(null);
      return;
    }

    let video: HTMLVideoElement | null = document.createElement("video");
    video.src = url;

    const handleCanPlay = () => setCanPlay(true);
    const handleError = () => setCanPlay(false);

    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("error", handleError);

    video.load();

    return () => {
      video?.removeEventListener("canplay", handleCanPlay);
      video?.removeEventListener("error", handleError);
      video = null;
    };
  }, [url]);

  if (canPlay === null) {
    return <Spinner />;
  }

  if (!canPlay) {
    return (
      <div style={{...(style || {}), maxWidth: "100%"}} className={className}>
        <Text size="large" variant="primary">⚠️ Your browser cannot play this video format.</Text>
        <a href={url} download className="underline">
          Download video instead
        </a>
      </div>
    );
  }

  return (
    <video controls style={{maxWidth: "100%", ...(style || {})}} className={className}>
      <source src={url} />
      Your browser does not support the video tag.
    </video>
  );
}

const useFileView = ({file, styles, classNames}: TypeUseFileView) => {
  if (!file) {
    return null;
  }

  const contentTypeMapping = [
    {
      regex: /^image\//,
      viewer: (file: TypeFile) => (
        <img src={file.url} alt={file.name} style={styles?.image} className={classNames?.image} />
      )
    },
    {
      regex: /^video\//,
      viewer: (file: TypeFile) => (
        <SafeVideoPlayer url={file.url} className={classNames?.video} style={styles?.video} />
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
      viewer: (file: TypeFile) => (
        <embed
          type={file.content.type}
          src={file.url}
          style={styles?.pdf}
          className={classNames?.pdf}
        />
      )
    },
    {
      regex: /^application\/zip/,
      viewer: () => <Icon name="folderZip" size={72} className={classNames?.zip} />
    }
  ];

  const match = contentTypeMapping.find(({regex}) => regex.test(file.content.type));

  if (match) {
    return match.viewer(file);
  }

  return <Icon name="fileDocument" size={72} />;
};

export default useFileView;
