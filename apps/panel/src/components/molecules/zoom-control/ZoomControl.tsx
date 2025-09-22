import React from 'react';
import styles from './ZoomControl.module.scss';
import Button from '../../atoms/button/Button';

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
      <Button onClick={resetView} className={styles.controlBtn} >Reset View</Button>
      <Button onClick={zoomIn} className={styles.controlBtn}  >Zoom In</Button>
      <Button onClick={zoomOut} className={styles.controlBtn} >Zoom Out</Button>
      <Button onClick={fitToView} className={styles.controlBtn} >Fit to View</Button>
      <span className={styles.zoomLevel}>{Math.round(zoom * 100)}%</span>
    </div>
  );
};

export default ZoomControl;