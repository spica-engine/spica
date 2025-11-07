import {useState, useEffect} from "react";

type AuthorizedEmbedProps = {
  type?: string;
  url: string;
  token?: string;
} & React.EmbedHTMLAttributes<HTMLEmbedElement>;

export function AuthorizedEmbed({
  type,
  url,
  token,
  ...props
}: AuthorizedEmbedProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  useEffect(() => {
    let urlObject: string;

    const loadFile = async () => {
      try {
        const response = await fetch(
          url,
          token
            ? {
                headers: {Authorization: `IDENTITY ${token}`}
              }
            : {}
        );
        if (!response.ok) throw new Error("Failed to fetch file");
        const blob = await response.blob();
        urlObject = URL.createObjectURL(blob);
        setObjectUrl(urlObject);
      } catch (error) {
        console.error("Failed to load file:", error);
      }
    };

    loadFile();

    return () => {
      if (urlObject) URL.revokeObjectURL(urlObject);
    };
  }, [url, token]);

  if (!objectUrl) return <div>Loading document...</div>;

  return (
    <embed type={type} src={objectUrl} {...props} />
  );
}
