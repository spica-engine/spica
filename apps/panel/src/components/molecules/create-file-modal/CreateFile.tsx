import React, {useState, useRef, type FC, type ReactNode} from "react";
import { Input } from "oziko-ui-kit";
import { useUploadFilesMutation } from "../../../store/api/storageApi";

type CreateFileProps = {
  prefix?: string;
  children: (props: {
    isOpen: boolean;
    onOpen: (e: React.MouseEvent) => void;
    onClose: () => void;
  }) => ReactNode;
};

const CreateFile: FC<CreateFileProps> = ({prefix = "", children}) => {
  const [uploadFiles, {isLoading}] = useUploadFilesMutation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    setIsModalOpen(false);
  };

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
          return new File([file], encodedFileName, { type: file.type });
        });
        
        const dataTransfer = new DataTransfer();
        filesWithPrefix.forEach(file => dataTransfer.items.add(file));
        
        await uploadFiles({files: dataTransfer.files});
      } catch (error) {
        console.error("File upload failed:", error);
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      {children({
        isOpen: isModalOpen,
        onOpen: handleOpen,
        onClose: handleClose
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
