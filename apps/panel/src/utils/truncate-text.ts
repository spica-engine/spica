export default function truncateText(text: string, maxLength: number): string {
  if (!text || maxLength <= 0) return "";
  return text.length > maxLength ? text.slice(0, maxLength) + "..." : text;
}
