export interface Storage {
  _id?: string;
  name: string;
  url?: string;
  content?: {
    type: string;
    size?: number;
  };
}

export type StorageTree = Storage & {
  parent: StorageTree;
  children: StorageTree[];
  depth: number;
  isDirectory: boolean;
  isSelected: boolean;
};
