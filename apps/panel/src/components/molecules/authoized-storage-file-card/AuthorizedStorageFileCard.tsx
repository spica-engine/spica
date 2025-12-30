import type { FC } from "react";
import useFileView from "../../../hooks/useFileView";
import type { TypeFile } from "oziko-ui-kit";
import { StorageFileCard } from "oziko-ui-kit";

//TODO: in the prefabs folder, there is authorized file types they should be moved to the molecules folder


const AuthorizedStorageFileCard: FC<{
    file: TypeFile;
    onClick: () => void;
    className?: string;
  }> = ({ file, onClick, className }) => {
    const view = useFileView({ file, isLoading: false }); 
  
    return (
      <StorageFileCard
        file={file}
        onClick={onClick}
        className={className}
        renderView={() => view}
        dimensionX="fill"
        dimensionY="fill"
      />
    );
  };
  
export default AuthorizedStorageFileCard;