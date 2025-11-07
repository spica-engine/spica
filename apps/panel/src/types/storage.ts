import type { TypeFile } from "oziko-ui-kit";

export interface DragItem {
  id: string;
  name: string;
  fullPath: string;
  parentPath: string;
  type: string;
  size: number;
}

export type DirectoryItem = TypeFile & {fullPath: string; label?: string; isActive?: boolean, currentDepth?: number; items?: DirectoryItem[];};

export type TypeDirectory = {
  items?: DirectoryItem[];
  label: string;
  fullPath: string;
  currentDepth?: number;
  isActive: boolean;
  content: {
    type: string;
    size: number;
  };
};
export type TypeDirectories = TypeDirectory[];
