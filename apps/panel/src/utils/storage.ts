export function convertToBytes(value: number | null, unit: string): number | null {
  if (value === null) return null;
  
  const multipliers = {
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
    tb: 1024 * 1024 * 1024 * 1024
  };
  
  return value * (multipliers[unit.toLowerCase() as keyof typeof multipliers] || 1);
}

export function convertQuickDateToRange(
  quickdate: string | null
): {from: Date | null; to: Date | null} {
  if (!quickdate) return {from: null, to: null};

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  switch (quickdate) {
    case "last_1_hour":
      return {from: new Date(now.getTime() - 60 * 60 * 1000), to: now};
    case "last_6_hour":
      return {from: new Date(now.getTime() - 6 * 60 * 60 * 1000), to: now};
    case "last_12_hour":
      return {from: new Date(now.getTime() - 12 * 60 * 60 * 1000), to: now};
    case "last_24_hour":
      return {from: new Date(now.getTime() - 24 * 60 * 60 * 1000), to: now};
    case "last_2_days":
      return {from: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), to: now};
    case "last_7_days":
      return {from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), to: now};
    case "last_14_days":
      return {from: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000), to: now};
    case "last_28_days":
      return {from: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000), to: now};
    case "today":
      return {from: today, to: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)};
    case "yesterday":
      return {from: yesterday, to: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1)};
    case "this_week":
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      return {from: startOfWeek, to: now};
    case "last_week":
      const lastWeekStart = new Date(today);
      lastWeekStart.setDate(today.getDate() - today.getDay() - 7);
      const lastWeekEnd = new Date(lastWeekStart);
      lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
      lastWeekEnd.setHours(23, 59, 59, 999);
      return {from: lastWeekStart, to: lastWeekEnd};
    default:
      return {from: null, to: null};
  }
}

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  return lastDotIndex !== -1 && lastDotIndex < filename.length - 1
    ? filename.substring(lastDotIndex + 1).toLowerCase()
    : '';
}

export function isImageFile(mimeType?: string, filename?: string): boolean {
  if (mimeType && mimeType.startsWith('image/')) {
    return true;
  }
  
  if (filename) {
    const extension = getFileExtension(filename);
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'];
    return imageExtensions.includes(extension);
  }
  
  return false;
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}