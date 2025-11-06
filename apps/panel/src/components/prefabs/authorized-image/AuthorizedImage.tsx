import {type TypeFile, Spinner} from "oziko-ui-kit";
import {useState, useEffect} from "react";
import styles from "./AuthorizedImage.module.scss";

type AuthorizedImageProps = {
  file: TypeFile;
  isLoading?: boolean;
  token?: string;
  containerProps?: React.HTMLAttributes<HTMLDivElement>;
  fallback?: React.ReactNode;
} & React.ImgHTMLAttributes<HTMLImageElement>;


export const AuthorizedImage = ({
  file,
  isLoading: externalLoading,
  token,
  containerProps,
  fallback,
  ...props
}: AuthorizedImageProps) => {
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;

    const fetchImage = async () => {
      try {
        setIsImageLoading(true);
        setError(null);

        const response = await fetch(file.url, {
          headers: token
            ? {
                Authorization: `IDENTITY ${token}`
              }
            : {}
        });

        if (!response.ok) {
          throw new Error("Failed to fetch image");
        }

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      } catch (error) {
        setError("Unable to load image.");
        setIsImageLoading(false);
      }
    };

    if (file.content.type.startsWith("image/") && token) {
      fetchImage();
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [file.url, token, file.content.type]);

  if (!file.content.type.startsWith("image/")) return null;

  const loading = Boolean(externalLoading) || isImageLoading;

  return (
    <div className={styles.container} {...(containerProps || {})}>
      {loading && (
        <div className={styles.spinnerContainer}>
          <Spinner />
        </div>
      )}
      {error && (
        <div className={styles.error}>
          {fallback || <span>Unable to load image.</span>}
        </div>
      )}
      {blobUrl && !error && (
        <img
          key={file.url}
          src={blobUrl}
          alt={file.name}
          onLoad={() => setIsImageLoading(false)}
          onError={() => {
            setIsImageLoading(false);
            setError("Unable to load image.");
          }}
          className={props.className}
          {...props}
          style={{...(props.style || {}), display: loading ? "none" : "block"}}
        />
      )}
    </div>
  );
};
