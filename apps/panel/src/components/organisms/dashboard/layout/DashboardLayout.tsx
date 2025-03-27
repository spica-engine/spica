import React, {type FC, useEffect, useRef} from "react";
import GridLayout, {type Layout} from "react-grid-layout";
import styles from "./DashboardLayout.module.scss";
import {type ChartData, type ChartOptions, type ChartType} from "chart.js";
import {Icon, Text, FlexElement} from "oziko-ui-kit";
import type {TypeFluidContainer} from "../../../../../../../node_modules/oziko-ui-kit/dist/components/atoms/fluid-container/FluidContainer";
import DashboardItem from "../../../atoms/dashboard-item/DashboardItem";
import "oziko-ui-kit/dist/index.css";

type TypeDashboardItem = {
  ratio: string;
  id: string;
  headerProps?: TypeFluidContainer;
  data?: ChartData<ChartType>;
  options?: ChartOptions<ChartType>;
};

type TypeDashboardLayout = {
  dashboards?: TypeDashboardItem[] | undefined;
};

const DashboardLayout: FC<TypeDashboardLayout> = ({dashboards}) => {
  const [width, setWidth] = React.useState(window.innerWidth);
  const [layout, setLayout] = React.useState<Layout[]>([]);
  const [dashboardItems, setDashboardItems] = React.useState<TypeDashboardItem[]>(dashboards || []);

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const layout = JSON.parse(localStorage.getItem("dashboardLayout") || "[]");

    const dashboardItemIds = dashboardItems.map((item: TypeDashboardItem) => item.id);
    const existDashboardItems = layout.filter((item: Layout) => dashboardItemIds.includes(item.i));
    console.log("existDashboardItems", existDashboardItems);
    if (existDashboardItems.length > 0) {
      return setLayout(existDashboardItems);
    }
    // if (!!layout && dashboardItems.length > 0) {
    //   console.log("layout", layout);
    //   return setLayout(JSON.parse(layout));
    // }
    // return setLayout(createLayout(dashboardItems));
  }, [dashboardItems]);

  const createLayout = (dashboardItems: TypeDashboardItem[]) => {
    const cols = 8;
    let currentX = 0;
    let currentY = 0;
    let currentRowHeight = 0;

    const layout: Layout[] = [];

    dashboardItems.forEach(item => {
      const [w, h] = item.ratio.split("/").map(Number);
      if (currentX + w > cols) {
        currentY += currentRowHeight;
        currentX = 0;
        currentRowHeight = 0;
      }

      layout.push({
        i: item.id,
        x: currentX,
        y: currentY,
        w: w,
        h: h
      });
      currentX += w;
      currentRowHeight = Math.max(currentRowHeight, h);
    });

    return layout;
  };

  const handleLayoutChange = (layout: Layout[]) => {
    saveLayoutToLS(layout);
  };

  const saveLayoutToLS = (layout: Layout[]) => {
    localStorage.setItem("dashboardLayout", JSON.stringify(layout));
  };

  const resizeItem = (id: string, newRatio: string) => {
    const updatedDashboardItems = dashboardItems.map(item =>
      item.id === id ? {...item, ratio: newRatio} : item
    );
    setDashboardItems(updatedDashboardItems);
    const updatedLayout = createLayout(updatedDashboardItems);
    saveLayoutToLS(updatedLayout);
  };

  return (
    <div className={styles.layoutContainer}>
      <GridLayout
        className={styles.gridLayout}
        layout={layout}
        width={width}
        cols={8}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".dragHandle"
      >
        {layout.map(item => (
          <div
            key={item.i}
            className={styles.gridItem}
            onClick={() => {
              console.log(item);
            }}
          >
            {item.i !== "addNewComponent" ? (
              <DashboardItem
                chartProps={{
                  type: "bar",
                  data: dashboardItems.find(dashboardItem => dashboardItem.id === item.i)?.data!,
                  options: dashboardItems.find(dashboardItem => dashboardItem.id === item.i)
                    ?.options!
                }}
                headerProps={{
                  content: "Title",
                  suffix: <Icon name="cog" className={styles.dragHandle} />
                }}
              />
            ) : (
              <FlexElement
                className={styles.addNewComponent}
                direction="vertical"
                alignment="center"
                dimensionX="fill"
                gap={15}
                dimensionY="fill"
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
