import type { TypeFile } from "oziko-ui-kit";

// oziko-ui-kit declares `_id` on TypeFile but never reads it; the panel reads keys through idOf.
export const kitFileKey = (id: string | undefined): Pick<TypeFile, "_id"> => ({ _id: id ?? "" });

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
