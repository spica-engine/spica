/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */
 
export function getTimestampFromObjectId(objectId: string | undefined): number {
  if (!objectId) return 0;
  return parseInt(objectId.substring(0, 8), 16) * 1000;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, unitIndex);

  return `${parseFloat(value.toFixed(2))} ${units[unitIndex]}`;
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
}

interface BuildFileUrlOptions {
  timestamp?: number;
  cacheBust?: boolean;
}

export function buildFileUrl(
  baseUrl: string | undefined,
  options: BuildFileUrlOptions = {}
): string | null {
  if (!baseUrl) return null;

  try {
    const url = new URL(baseUrl);
    
    if (options.timestamp) {
      url.searchParams.set("timestamp", String(options.timestamp));
    }
    
    if (options.cacheBust !== false) {
      url.searchParams.set("t", String(Date.now()));
    }
    
    return url.toString();
  } catch (error) {
    console.error("Error building URL:", error);
    return null;
  }
}

