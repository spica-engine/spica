import type { TypeFile } from "oziko-ui-kit";

export const ItemTypes = {
  STORAGE_ITEM: "storage_item"
} as const;

export interface DragItem {
  id: string;
  name: string;
  fullPath: string;
  isDirectory: boolean;
  parentPath: string;
}

export type TypeDirectoryDepth = number;
export type DirectoryItem = TypeFile & {fullPath: string; label?: string; isActive?: boolean, currentDepth?: TypeDirectoryDepth};
export type TypeDirectory = {
  items?: DirectoryItem[];
  label: string;
  fullPath: string;
  currentDepth?: TypeDirectoryDepth;
  isActive: boolean;
  content: {
    type: string;
    size: number;
  };
};
export type TypeDirectories = TypeDirectory[];
