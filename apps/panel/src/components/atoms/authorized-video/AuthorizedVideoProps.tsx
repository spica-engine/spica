import {useEffect, useState, type CSSProperties} from "react";

type AuthorizedVideoProps = {
  type?: string;
  url: string;
  token: string;
} & React.VideoHTMLAttributes<HTMLVideoElement>;

export function AuthorizedVideo({type, url, token, ...props}: AuthorizedVideoProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string;

    const loadVideo = async () => {
      try {
        const response = await fetch(url, {
          headers: {Authorization: `Bearer ${token}`}
        });
        if (!response.ok) throw new Error(`Failed to fetch video: ${response.statusText}`);
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        setVideoUrl(objectUrl);
      } catch (error) {
        console.error("Error loading authorized video:", error);
      }
    };

    loadVideo();

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, token]);

  if (!videoUrl) return <div>Loading video...</div>;

  return (
    <video controls {...props}>
      <source src={videoUrl} type={type} />
      Your browser does not support the video tag.
    </video>
  );
}
