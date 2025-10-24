import type { TypeFile } from "oziko-ui-kit";
import useStorage from "../../../hooks/useStorage";
import type { TypeDirectories } from "src/types/storage";

export function useStorageConverter(directory: TypeDirectories) {
  const {convertStorageToTypeFile} = useStorage();
    
  const convertData = (data: TypeFile[]) => {
    const convertedData = data?.map(storage => {
      const typeFile = convertStorageToTypeFile(storage);
      const nameParts = typeFile.name.split("/").filter(Boolean);
      const isFolder = typeFile.content.type === "inode/directory";
      const resolvedName = nameParts[nameParts.length - 1] + (isFolder ? "/" : "");

      return {
        ...typeFile,
        items: undefined,
        label: resolvedName,
        fullPath: storage.name,
        currentDepth: directory.filter(dir => dir.currentDepth).length,
        isActive: false
      };
    });
    return convertedData;
  };

  return {convertData};
}