import { CircularProgress } from "oziko-ui-kit";
import {useState, useEffect} from "react";
import styles from "./UploadOverlay.module.scss";

export const UploadOverlay = ({
  loading,
  progress,
  error: externalError
}: {
  loading: boolean;
  progress: number;
  error: unknown;
}) => {
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    if (progress === 100 && loading && !externalError) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 2000);
      return () => clearTimeout(timer);
    }

    if (loading && progress < 100) {
      setShowSuccess(false);
    }

    if (!loading && showSuccess) {
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

  const getState = () => {
    if (showError) return "error";
    if (showSuccess) return "success";
    if (loading) return "loading";
    return "idle";
  };

  const state = getState();

  const content = {
    error: (
      <CircularProgress
        strokeWidth={3}
        size="xxs"
        percent={100}
        status="danger"
        label={undefined}
      />
    ),
    success: (
      <CircularProgress
        strokeWidth={3}
        size="xxs"
        percent={100}
        status="success"
        label={undefined}
      />
    ),
    loading: (
      <CircularProgress
        strokeWidth={3}
        size="xxs"
        percent={progress}
        status="normal"
        label={null}
      />
    ),
    idle: null
  }[state];

  return content ? <div className={styles.uploadOverlay}>{content}</div> : null;
};
