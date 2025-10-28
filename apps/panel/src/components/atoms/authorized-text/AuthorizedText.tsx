import {Spinner} from "oziko-ui-kit";
import React from "react";
import styles from "./AuthorizedText.module.scss";

const DEFAULT_HEIGHT = 400;

type AuthorizedTextProps = {
  fileUrl: string;
  loading?: boolean;
  iframeProps?: React.IframeHTMLAttributes<HTMLIFrameElement>;
  token?: string;
} & React.HTMLAttributes<HTMLDivElement>;

/**
 * NOTE: This component has been manually tested with sample text files.
 * Expected behavior confirmed: files render correctly with no visible issues.
 * ⚠️ Review by a security-experienced developer is recommended
 * before using with sensitive or untrusted content.
 */
export const AuthorizedText: React.FC<AuthorizedTextProps> = ({
  fileUrl,
  loading: externalLoading,
  iframeProps,
  token,
  ...props
}) => {
  const [iframeSrc, setIframeSrc] = React.useState<string>("");
  const [isTextLoading, setIsTextLoading] = React.useState(true);

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
    setIsTextLoading(true);

    const loadTextContent = async () => {
      try {
        const res = await fetch(fileUrl, {
          cache: "no-store",
          headers: token ? {Authorization: `IDENTITY ${token}`} : {}
        });

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
        setIsTextLoading(false);
      } catch (err) {
        const errorHtml = `<!DOCTYPE html><html><body style="display:flex;align-items:center;justify-content:center;height:100%;">Failed to load file content</body></html>`;
        const blob = new Blob([errorHtml], {type: "text/html"});
        setIframeSrc(URL.createObjectURL(blob));
        setIsTextLoading(false);
        console.error("TextViewer fetch error:", err);
      }
    };

    loadTextContent();

    return () => {
      cancelled = true;
      if (iframeSrc && iframeSrc.startsWith("blob:")) {
        URL.revokeObjectURL(iframeSrc);
      }
    };
  }, [fileUrl, token]);

  const loading = Boolean(externalLoading) || isTextLoading;

  if (!iframeSrc && !loading) return null;

  return (
    <div {...props} className={`${props.className || ""} ${styles.container}`}>
      {loading && (
        <div className={styles.spinnerContainer}>
          <Spinner />
        </div>
      )}
      <iframe
        src={iframeSrc}
        width="100%"
        sandbox=""
        referrerPolicy="no-referrer"
        title="Text file viewer"
        height={DEFAULT_HEIGHT}
        {...iframeProps}
        style={{...(iframeProps?.style || {}), display: loading ? "none" : "block"}}
        className={`${iframeProps?.className || ""} ${styles.iframe}`}
      />
    </div>
  );
};
