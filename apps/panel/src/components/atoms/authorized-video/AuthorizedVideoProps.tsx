import { Spinner } from "oziko-ui-kit";
import {useEffect, useState, type CSSProperties} from "react";

type AuthorizedVideoProps = {
  type?: string;
  url: string;
  token: string;
  fallback?: React.ReactNode;
} & React.VideoHTMLAttributes<HTMLVideoElement>;

export function AuthorizedVideo({type, url, token, fallback, ...props}: AuthorizedVideoProps) {
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
          headers: {Authorization: `Bearer ${token}`}
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

  const handleError = () => {
    setIsVideoLoading(false);
    setError("Unable to load video.");
  }

  return (
    <div style={props.style}>
      {loading && (
        <div>
          <Spinner />
        </div>
      )}
      {error && (
        <div>
          {fallback || <span>Unable to load video.</span>}
        </div>
      )}
      {videoUrl && !error && (
        <video
          controls
          {...props}
          style={{...(props.style || {}), display: loading ? "none" : "block"}}
          onLoadedData={() => setIsVideoLoading(false)}
          onError={handleError}
        >
          <source src={videoUrl} type={type} />
          Your browser does not support the video tag.
        </video>
      )}
    </div>
  );
}
