import React, {useRef, type FC, type ReactNode} from "react";
import {useUploadFilesMutation} from "../../../store/api/storageApi";

type CreateFileProps = {
  prefix?: string;
  children: (props: {onOpen: (e: React.MouseEvent) => void}) => ReactNode;
};

const CreateFile: FC<CreateFileProps> = ({prefix = "", children}) => {
  const [uploadFiles, {isLoading}] = useUploadFilesMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      try {
        const filesWithPrefix = Array.from(files).map(file => {
          const fileName = prefix + file.name;
          const encodedFileName = encodeURIComponent(fileName);
          return new File([file], encodedFileName, {type: file.type});
        });

        const dataTransfer = new DataTransfer();
        filesWithPrefix.forEach(file => dataTransfer.items.add(file));

        await uploadFiles({files: dataTransfer.files});
      } catch (error) {
        console.error("File upload failed:", error);
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <>
      {children({
        onOpen: handleOpen
      })}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{display: "none"}}
        onChange={handleFileChange}
        disabled={isLoading}
      />
    </>
  );
};

export default CreateFile;
