import {useRef, type FC, type CSSProperties} from "react";
import styles from "./DraggableBar.module.scss";

type TypeDraggableBar = {
  x: number;
  y: number;
  maxX?: number;
  minX?: number;
  maxY?: number;
  minY?: number;
  height?: number;
  style?: CSSProperties;
  onChange?: (position: {x: number; y: number}) => void;
  onUp?: () => void;
  onDown?: () => void;
};

const DraggableBar: FC<TypeDraggableBar> = ({
  x,
  y,
  maxX,
  minX,
  maxY,
  minY,
  height,
  style,
  onChange,
  onDown,
  onUp
}) => {
  const barRef = useRef(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startPos = useRef(0);

  const handleMouseDown = (e: any) => {
    isDragging.current = true;
    startX.current = e.clientX;
    startPos.current = x;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    onDown?.();
  };

  const handleMouseMove = (e: any) => {
    if (!isDragging.current) return;
    const deltaX = e.clientX - startX.current;
    const newX = startPos.current + deltaX;

    const isXWithinBounds = (minX ? newX >= minX : true) && (maxX ? newX <= maxX : true);
    if (!isXWithinBounds) return;

    onChange?.({x: newX, y});
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    onUp?.();
  };

  return (
    <div
      ref={barRef}
      onMouseDown={handleMouseDown}
      className={styles.bar}
      style={{
        ...style,
        left: `${x}px`,
        bottom: `${y}px`,
        height: `${height}px`
      }}
    />
  );
};

export default DraggableBar;
