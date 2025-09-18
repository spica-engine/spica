import { useState, useEffect } from "react";
import type { MutableRefObject } from "react";
import type { Node } from "./useBucketConverter";

export const useDiagramInteractions = (
  nodes: Node[],
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>,
  containerRef: MutableRefObject<HTMLDivElement | null>
) => {
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [isInitialized, setIsInitialized] = useState(false);

  const calculateFitToView = () => {
    if (nodes.length === 0 || !containerRef.current) return { zoom: 1, pan: { x: 0, y: 0 } };
    
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
    
    const padding = 50;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    
    const zoomX = containerWidth / width;
    const zoomY = containerHeight / height;
    const newZoom = Math.min(zoomX, zoomY, 1);
    
    return {
      zoom: newZoom,
      pan: {
        x: containerWidth / 2 - ((minX + maxX) / 2) * newZoom,
        y: containerHeight / 2 - ((minY + maxY) / 2) * newZoom
      }
    };
  };

  useEffect(() => {
    if (nodes.length > 0 && containerRef.current && !isInitialized) {
      const { zoom: initialZoom, pan: initialPan } = calculateFitToView();
      setZoom(initialZoom);
      setPan(initialPan);
      setIsInitialized(true);
    }
  }, [nodes, containerRef, isInitialized]);

  const zoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 3));
  };

  const zoomOut = () => {
    setZoom(prev => Math.max(prev / 1.2, 0.1));
  };

  const fitToView = () => {
    if (nodes.length === 0 || !containerRef.current) return;
    
    const { zoom: newZoom, pan: newPan } = calculateFitToView();
    setZoom(newZoom);
    setPan(newPan);
  };

  const resetView = () => {
    const { zoom: newZoom, pan: newPan } = calculateFitToView();

    setPan(newPan);
    setZoom(newZoom);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom(prev => Math.min(prev * 1.05, 3));
    } else {
      setZoom(prev => Math.max(prev / 1.05, 0.3));
    }
  };

  const handlePanStart = (e: React.MouseEvent) => {
    if (
      e.target === containerRef.current ||
      (e.target as HTMLElement).closest(".diagram-content")
    ) {
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  };

  const handlePanMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const deltaX = e.clientX - lastPanPoint.x;
      const deltaY = e.clientY - lastPanPoint.y;
      setPan(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    }
  };

  const handlePanEnd = () => {
    setIsPanning(false);
  };

  const handleMouseDown = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setDragging(nodeId);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const nodeScreenX = node.position.x * zoom + pan.x;
    const nodeScreenY = node.position.y * zoom + pan.y;

    setDragOffset({
      x: mouseX - nodeScreenX,
      y: mouseY - nodeScreenY
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newX = (mouseX - pan.x - dragOffset.x) / zoom;
      const newY = (mouseY - pan.y - dragOffset.y) / zoom;

      setNodes(prev =>
        prev.map(node => (node.id === dragging ? { ...node, position: { x: newX, y: newY } } : node))
      );
    } else {
      handlePanMove(e);
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
    handlePanEnd();
  };

  return {
    dragging,
    dragOffset,
    pan,
    setPan,
    isPanning,
    zoom,
    setZoom,
    zoomIn,
    zoomOut,
    fitToView,
    resetView,
    handleWheel,
    handlePanStart,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp
  };
};