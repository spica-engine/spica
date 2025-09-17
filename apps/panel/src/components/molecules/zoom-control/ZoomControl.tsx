import React, { useState, useRef } from 'react';
import styles from './ZoomControl.module.scss';

interface ZoomControlProps {
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  nodes: {
    id: string;
    position: { x: number; y: number };
    fields: any[];
  }[];
}

const ZoomControl: React.FC<ZoomControlProps> = ({ zoom, setZoom, setPan, containerRef, nodes }) => {
  // Zoom handlers
  const zoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 3)); // Limit max zoom to 3x
  };

  const zoomOut = () => {
    setZoom(prev => Math.max(prev / 1.2, 0.3)); // Limit min zoom to 0.3x
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom(prev => Math.min(prev * 1.05, 3));
    } else {
      setZoom(prev => Math.max(prev / 1.05, 0.3));
    }
  };

  // Fit to view function
  const fitToView = () => {
    if (nodes.length === 0 || !containerRef.current) return;
    
    // Calculate bounding box of all nodes
    const nodeWidth = 350;
    const nodeHeight = 300;
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    nodes.forEach(node => {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + nodeWidth);
      maxY = Math.max(maxY, node.position.y + nodeHeight);
    });
    
    // Add padding
    const padding = 50;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    // Get container dimensions
    const containerRect = containerRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    
    // Calculate zoom to fit
    const zoomX = containerWidth / width;
    const zoomY = containerHeight / height;
    const newZoom = Math.min(zoomX, zoomY, 1); // Cap at 1 to prevent zooming in too much
    
    // Set the new zoom and center the view
    setZoom(newZoom);
    setPan({
      x: containerWidth / 2 - ((minX + maxX) / 2) * newZoom,
      y: containerHeight / 2 - ((minY + maxY) / 2) * newZoom
    });
  };

  const resetView = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  };

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