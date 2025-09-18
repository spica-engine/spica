import React from 'react';
import styles from './ZoomControl.module.scss';

interface ZoomControlProps {
  zoom: number;
  zoomIn: () => void;
  zoomOut: () => void;
  fitToView: () => void;
  resetView: () => void;
}

const ZoomControl: React.FC<ZoomControlProps> = ({ zoom, zoomIn, zoomOut, fitToView, resetView }) => {
  return (
    <div className={styles.controls}>
      <button onClick={resetView} className={styles.controlBtn}>Reset View</button>
      <button onClick={zoomIn} className={styles.controlBtn}>Zoom In</button>
      <button onClick={zoomOut} className={styles.controlBtn}>Zoom Out</button>
      <button onClick={fitToView} className={styles.controlBtn}>Fit to View</button>
      <span className={styles.zoomLevel}>{Math.round(zoom * 100)}%</span>
    </div>
  );
};

export default ZoomControl;