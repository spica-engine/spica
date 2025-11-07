import type { TypeFile } from "oziko-ui-kit";

/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */
export function isLocalServerUrl(urlStr?: string): boolean {
  if (!urlStr) return false;

  try {
    const {hostname} = new URL(urlStr);

    // Check localhost variations
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "0.0.0.0" ||
      hostname.endsWith(".local")
    ) {
      return true;
    }

    // Check private LAN ranges (10.x.x.x, 192.168.x.x, 172.16-31.x.x)
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(hostname)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export function formatGoogleStorageUrl(url: string): string | null {
  const parsed = new URL(url);
  const match = parsed.pathname.match(/\/b\/([^/]+)\/o\/([^/]+)/);
  if (!match) return null;
  const [, projectName, objectId] = match;
  return `${parsed.protocol}//${parsed.host}/${projectName}/${objectId}`;
}

function getCopyUrl(file?: TypeFile): string {
  if (!file) return "";

  const serverUrl = import.meta.env.VITE_BASE_URL as string;
  const isLocal = isLocalServerUrl(serverUrl);
  const origin = window.location.origin;

  if (isLocal) {
    return `${origin}/storage-view/${file._id}`;
  }

  const url = new URL(file.url);

  if (url.hostname === "storage.googleapis.com") {
    const formattedUrl = formatGoogleStorageUrl(file.url);
    if (formattedUrl) {
      return formattedUrl;
    }
  }

  return `${origin}/storage-view/${file._id}`;
}

interface UrlConfig {
  serverUrl: string;
  origin: string;
}

export function generatePublicFileUrl(
  fileId: string,
  fileUrl: string,
  config: UrlConfig
): string {
  const {serverUrl, origin} = config;

  if (isLocalServerUrl(serverUrl)) {
    return `${origin}/storage-view/${fileId}`;
  }

  try {
    const url = new URL(fileUrl);

    // Handle Google Cloud Storage URLs
    if (url.hostname === "storage.googleapis.com") {
      const formattedUrl = formatGoogleStorageUrl(fileUrl);
      if (formattedUrl) {
        return formattedUrl;
      }
    }
  } catch {
    // If URL parsing fails, fallback to storage-view
  }

  // Default fallback to storage-view endpoint
  return `${origin}/storage-view/${fileId}`;
}

