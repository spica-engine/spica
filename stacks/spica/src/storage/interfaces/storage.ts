export interface Storage {
  _id?: string;
  name: string;
  url?: string;
  content?: {
    type: string;
    size?: number;
  };
}

export type StorageNode = Storage & {
  parent: StorageNode;
  children: StorageNode[];
  depth: number;
  isDirectory: boolean;
  isHighlighted: boolean;
};