import {Spinner} from "oziko-ui-kit";
import {useEffect, useState} from "react";
import styles from "./AuthorizedVideo.module.scss";

type AuthorizedVideoProps = {
  type?: string;
  url: string;
  token: string;
  fallback?: React.ReactNode;
  containerProps?: React.HTMLAttributes<HTMLDivElement>;
} & React.VideoHTMLAttributes<HTMLVideoElement>;

export function AuthorizedVideo({
  type,
  url,
  token,
  fallback,
  containerProps,
  ...props
}: AuthorizedVideoProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;

    const loadVideo = async () => {
      try {
        setIsVideoLoading(true);
        setError(null);
        const response = await fetch(url, {
          headers: {Authorization: `IDENTITY ${token}`}
        });
        if (!response.ok) throw new Error("Failed to fetch video");
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        setVideoUrl(objectUrl);
      } catch (error) {
        setError("Unable to load video.");
        setIsVideoLoading(false);
      }
    };

    if (token) {
      loadVideo();
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [url, token]);
  const loading = (isVideoLoading || !videoUrl) && !error;

  const handleError = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    setIsVideoLoading(false);
    setError("Unable to load video.");
    props.onError?.(event);
  };

  const handleOnLoadedData = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    setIsVideoLoading(false);
    props.onLoadedData?.(event);
  };

  return (
    <div {...(containerProps || {})} className={`${props.className} ${styles.container}`}>
      {loading && (
        <div>
          <Spinner />
        </div>
      )}
      {error && <div>{fallback || <span>Unable to load video.</span>}</div>}
      {videoUrl && !error && (
        <video
          controls
          {...props}
          className={`${styles.video} ${props.className}`}
          style={{...(props.style || {}), display: loading ? "none" : "block"}}
          onLoadedData={handleOnLoadedData}
          onError={handleError}
        >
          <source src={videoUrl} type={type} />
          Your browser does not support the video tag.
        </video>
      )}
    </div>
  );
}
