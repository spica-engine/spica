import type { TypeDirectories } from "src/components/organisms/storage-columns/StorageColumns";

export const ROOT_PATH = "/";

export const INITIAL_DIRECTORIES: TypeDirectories = [
  {
    items: undefined,
    label: "",
    fullPath: ROOT_PATH,
    currentDepth: 1,
    isActive: true,
    content: {type: "inode/directory", size: 0}
  }
];
