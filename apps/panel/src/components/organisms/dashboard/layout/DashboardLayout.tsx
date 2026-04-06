import React, {type FC, useCallback, useEffect, useMemo, useState} from "react";
import GridLayout, {type Layout} from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import styles from "./DashboardLayout.module.scss";
import {Icon, Text, FlexElement} from "oziko-ui-kit";
import type {Dashboard, DashboardComponent} from "../../../../store/api/dashboardApi";
import DashboardComponentRenderer from "../component-renderer/DashboardComponentRenderer";

type TypeDashboardLayout = {
  dashboard?: Dashboard;
  dashboardId?: string;
  componentDataMap?: Record<number, any>;
  componentLoadingMap?: Record<number, boolean>;
  componentErrorMap?: Record<number, any>;
  onAddComponent?: () => void;
  onComponentSettingsClick?: (componentIndex: number) => void;
  onLayoutChange?: (layout: Layout[]) => void;
};

function getStorageKey(dashboardId?: string): string {
  return dashboardId ? `dashboardLayout_${dashboardId}` : "dashboardLayout";
}

const CELL_SIZE = 250;
const ROW_HEIGHT = CELL_SIZE;
const MARGIN: [number, number] = [10, 10];
const CONTAINER_PADDING: [number, number] = [0, 0];

const ADD_TILE_ID = "addNewComponent";
const ADD_TILE: Layout = {i: ADD_TILE_ID, x: 0, y: 0, w: 1, h: 1, static: true, isDraggable: false, isResizable: false};

function buildAutoLayout(components: DashboardComponent[], cols: number, hasAddTile: boolean): Layout[] {
  let currentX = hasAddTile ? ADD_TILE.w : 0;
  let currentY = 0;
  let currentRowHeight = hasAddTile ? ADD_TILE.h : 0;

  return components.map((comp, index) => {
    const [w, h] = comp.ratio.split("/").map(Number);
    if (currentX + w > cols) {
      currentY += currentRowHeight;
      currentX = 0;
      currentRowHeight = 0;
    }
    const item: Layout = {i: String(index), x: currentX, y: currentY, w, h};
    currentX += w;
    currentRowHeight = Math.max(currentRowHeight, h);
    return item;
  });
}

const DashboardLayout: FC<TypeDashboardLayout> = ({
  dashboard,
  dashboardId,
  componentDataMap = {},
  componentLoadingMap = {},
  componentErrorMap = {},
  onAddComponent,
  onComponentSettingsClick,
  onLayoutChange: onLayoutChangeProp
}) => {
  const [availableWidth, setAvailableWidth] = useState(window.innerWidth - 340);
  const [layout, setLayout] = useState<Layout[]>([]);

  const components = useMemo(() => dashboard?.components ?? [], [dashboard?.components]);

  // Derive cols so each column is exactly CELL_SIZE px wide
  const cols = Math.max(1, Math.floor((availableWidth + MARGIN[0]) / (CELL_SIZE + MARGIN[0])));
  const gridWidth = cols * CELL_SIZE + (cols - 1) * MARGIN[0];

  useEffect(() => {
    const handleResize = () => setAvailableWidth(Math.max(window.innerWidth - 340, CELL_SIZE));
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const hasAddTile = !!onAddComponent;

  useEffect(() => {
    const storageKey = getStorageKey(dashboardId);
    const storedRaw = localStorage.getItem(storageKey);
    const storedLayout: Layout[] = storedRaw ? JSON.parse(storedRaw) : [];

    const componentIds = components.map((_c, i) => String(i));
    const validStored = storedLayout.filter((item: Layout) => componentIds.includes(item.i));

    if (validStored.length === components.length && validStored.length > 0) {
      setLayout(validStored);
    } else {
      const auto = buildAutoLayout(components, cols, hasAddTile);
      setLayout(auto);
    }
  }, [components, dashboardId, cols, hasAddTile]);

  const fullLayout = useMemo(() => {
    if (!hasAddTile) return layout;
    return [ADD_TILE, ...layout];
  }, [layout, hasAddTile]);

  const handleLayoutChange = useCallback(
    (newLayout: Layout[]) => {
      const filtered = newLayout.filter(item => item.i !== ADD_TILE_ID);
      setLayout(filtered);
      const storageKey = getStorageKey(dashboardId);
      localStorage.setItem(storageKey, JSON.stringify(filtered));
      onLayoutChangeProp?.(filtered);
    },
    [dashboardId, onLayoutChangeProp]
  );

  return (
    <div className={styles.layoutContainer}>
      <GridLayout
        className={styles.gridLayout}
        layout={fullLayout}
        width={gridWidth}
        cols={cols}
        rowHeight={ROW_HEIGHT}
        margin={MARGIN}
        containerPadding={CONTAINER_PADDING}
        compactType="vertical"
        onLayoutChange={handleLayoutChange}
        isDraggable
        isResizable={false}
        draggableCancel=".noDrag"
      >
        {fullLayout.map(item => (
          <div key={item.i} className={styles.gridItem}>
            {item.i !== ADD_TILE_ID ? (
              <DashboardComponentRenderer
                component={components[Number(item.i)]}
                data={componentDataMap[Number(item.i)]}
                isLoading={componentLoadingMap[Number(item.i)]}
                error={componentErrorMap[Number(item.i)]}
                onSettingsClick={() => onComponentSettingsClick?.(Number(item.i))}
              />
            ) : (
              <FlexElement
                className={styles.addNewComponent}
                direction="vertical"
                alignment="center"
                dimensionX="fill"
                gap={15}
                dimensionY="fill"
                onClick={onAddComponent}
              >
                <Icon name="plus" className={styles.plusIcon} />
                <Text size="xlarge"> New Component</Text>
              </FlexElement>
            )}
          </div>
        ))}
      </GridLayout>
    </div>
  );
};

export default DashboardLayout;
