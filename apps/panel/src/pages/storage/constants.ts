import type { TypeDirectories } from "../../types/storage";

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
