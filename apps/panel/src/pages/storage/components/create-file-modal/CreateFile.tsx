/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */
 
import React, {useRef, useState, useEffect, type FC} from "react";
import {useUploadFilesMutation} from "../../../../store/api/storageApi";
import {Icon, Button, CircularProgress} from "oziko-ui-kit";
import styles from "./CreateFile.module.scss";

type CreateFileProps = {
  prefix?: string;
  className?: string;
};

type ButtonState = "idle" | "loading" | "success" | "error";

const CreateFile: FC<CreateFileProps> = ({prefix = "", className}) => {
  const [uploadFiles, {isLoading, error, isSuccess}] = useUploadFilesMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState(0);
  const [buttonState, setButtonState] = useState<ButtonState>("idle");

  const resetToIdle = () => {
    const timer = setTimeout(() => {
      setButtonState("idle");
      setProgress(0);
    }, 1000);
    return () => clearTimeout(timer);
  };

  useEffect(() => {
    if (isLoading) {
      setButtonState("loading");
    } else if (error) {
      setButtonState("error");
      return resetToIdle();
    } else if (isSuccess) {
      setButtonState("success");
      return resetToIdle();
    }
  }, [isLoading, error, isSuccess]);

  useEffect(() => {
    if (!isLoading) {
      setProgress(0);
    }
  }, [isLoading]);

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
        for (const file of filesWithPrefix) {
          dataTransfer.items.add(file);
        }

       await uploadFiles({files: dataTransfer.files, onProgress: setProgress});
      } catch (error) {
        console.error("File upload failed:", error);
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const buttonContent = {
    error: {
      icon: (
        <CircularProgress
          strokeWidth={3}
          size="xxs"
          percent={100}
          status="danger"
          label={undefined}
        />
      ),
      text: "Failed!"
    },
    success: {
      icon: (
        <CircularProgress
          strokeWidth={3}
          size="xxs"
          percent={100}
          status="success"
          label={undefined}
        />
      ),
      text: "Success!"
    },
    loading: {
      icon: (
        <CircularProgress
          strokeWidth={3}
          size="xxs"
          percent={progress}
          status="normal"
          label={null}
        />
      ),
      text: "Loading..."
    },
    idle: {icon: <Icon name="plus" />, text: "Upload Files"}
  }[buttonState];

  return (
    <>
      <Button 
        className={`${styles.uploadButton} ${className}`}
        variant="filled" 
        onClick={handleOpen} 
        disabled={isLoading}
      >
        {buttonContent.icon}
        {buttonContent.text}
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
