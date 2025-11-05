import React, {useRef, type FC} from "react";
import {useUploadFilesMutation} from "../../../../store/api/storageApi";
import {Icon, Button, Input} from "oziko-ui-kit";

type CreateFileProps = {
  prefix?: string;
  className?: string;
};

const CreateFile: FC<CreateFileProps> = ({prefix = "", className}) => {
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
      <Button variant="filled" onClick={handleOpen} className={className}>
        <Icon name="plus" />
        Upload Files
      </Button>
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
