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
  const isMaxZoom = zoom >= 3;
  const isMinZoom = zoom <= 0.1;

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    zoomIn();
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    zoomOut();
  };

  const handleResetView = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    resetView();
  };

  const handleFitToView = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    fitToView();
  };

  return (
    <div className={styles.controls} onMouseDown={(e) => e.stopPropagation()}>
      <Button onClick={handleResetView} className={styles.controlBtn} >Reset View</Button>
      <Button 
        onClick={handleZoomIn} 
        className={styles.controlBtn} 
        disabled={isMaxZoom}
      >
        Zoom In
      </Button>
      <Button 
        onClick={handleZoomOut} 
        className={styles.controlBtn}
        disabled={isMinZoom}
      >
        Zoom Out
      </Button>
      <Button onClick={handleFitToView} className={styles.controlBtn} >Fit to View</Button>
      <span className={styles.zoomLevel}>{Math.round(zoom * 100)}%</span>
    </div>
  );
};

export default ZoomControl;