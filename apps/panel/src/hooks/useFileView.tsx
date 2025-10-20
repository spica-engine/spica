import {Icon, type TypeFile} from "oziko-ui-kit";
import type {CSSProperties} from "react";
import {useEffect, useRef} from "react";
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

const TextViewer: React.FC<TextViewerProps> = ({fileUrl, style, className, height = 400}) => {
  const iframeSrc = useMemo(() => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src *;">
          <meta http-equiv="X-Content-Type-Options" content="nosniff">
          <style>
            body {
              background: white;
              color: black;
              font-family: monospace;
              white-space: pre-wrap;
              padding: 1rem;
              margin: 0;
              overflow-wrap: break-word;
              word-break: break-word;
            }
          </style>
        </head>
        <body>Loading...</body>
        <script>
          (function() {
            'use strict';
            const fileUrl = ${JSON.stringify(fileUrl)};
            
            fetch(fileUrl)
              .then(function(response) {
                if (!response.ok) {
                  throw new Error('Failed to load file');
                }
                return response.text();
              })
              .then(function(text) {
                // Use textContent to prevent any HTML/script injection
                document.body.textContent = text;
              })
              .catch(function(err) {
                // Generic error message to avoid information leakage
                document.body.textContent = 'Failed to load file content';
                console.error('Error loading file:', err);
              });
          })();
        </script>
      </html>
    `;

    const blob = new Blob([html], {type: "text/html"});
    return URL.createObjectURL(blob);
  }, [fileUrl]);

  useEffect(() => {
    return () => {
      if (iframeSrc.startsWith("blob:")) {
        URL.revokeObjectURL(iframeSrc);
      }
    };
  }, [iframeSrc]);

  return (
    <iframe
      src={iframeSrc}
      width="100%"
      height={height}
      style={{border: "none", ...(style || {})}}
      className={className}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      title="Text file viewer"
    />
  );
};

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