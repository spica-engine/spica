import { CircularProgress, Icon, Button } from "oziko-ui-kit";
import { useState, useEffect, type MouseEvent } from "react";

type UploadFilesButtonProps = {
  onOpen: (e: MouseEvent) => void;
  loading: boolean;
  progress: number;
  className: string;
  error?: unknown;
};

export function UploadFilesButton({
  onOpen,
  loading,
  progress,
  className,
  error: externalError
}: UploadFilesButtonProps) {
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    if (progress === 100 && loading && !externalError) {
      setShowSuccess(true);
    }

    if (loading && progress < 100) {
      setShowSuccess(false);
    }

    if (!loading) {
      setTimeout(() => {
        setShowSuccess(false);
      }, 2000);
    }
  }, [loading, progress, externalError]);

  useEffect(() => {
    if (externalError) {
      setShowError(true);
      const timer = setTimeout(() => setShowError(false), 2000);
      return () => clearTimeout(timer);
    } else {
      setShowError(false);
    }
  }, [externalError]);

  const getButtonState = () => {
    if (showError) return "error";
    if (showSuccess) return "success";
    if (loading) return "loading";
    return "idle";
  };

  const buttonState = getButtonState();

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
      text: "Upload Failed"
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
    <Button
      className={className}
      variant="filled"
      onClick={onOpen}
      disabled={buttonState !== "idle"}
    >
      {buttonContent.icon}
      {buttonContent.text}
    </Button>
  );
}