import {memo, useRef, type FC, useEffect, useState} from "react";
import styles from "./Timeline.module.scss";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  type ChartData,
  Chart,
  type ScaleOptionsByType,
  type CartesianScaleTypeRegistry,
  type PluginOptionsByType
} from "chart.js";
import {Bar} from "react-chartjs-2";
import zoomPlugin from "chartjs-plugin-zoom";
import annotationPlugin from "chartjs-plugin-annotation";
import "chartjs-adapter-date-fns";
import {
  Icon,
  Button,
  FluidContainer,
  FlexElement,
  Text,
  type TypeFluidContainer
} from "oziko-ui-kit";
import {timeUtil} from "oziko-ui-kit";
import {type _DeepPartialObject} from "../../../../../../node_modules/chart.js/dist/types/utils";
import DraggableBar from "../../atoms/draggable-bar/DraggableBar";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  TimeScale,
  Title,
  Tooltip,
  Legend,
  zoomPlugin,
  annotationPlugin
);

export type TypeBarChartData = ChartData<"bar", (number | [number, number] | null)[], unknown>;
type TypeScales =
  | _DeepPartialObject<{[key: string]: ScaleOptionsByType<keyof CartesianScaleTypeRegistry>}>
  | undefined;

type TypePlugins = _DeepPartialObject<PluginOptionsByType<"bar">> | undefined;

type TypeBarPosition = {x: number; y: number} | null;

type TypeUnit =
  | "millisecond"
  | "second"
  | "minute"
  | "hour"
  | "day"
  | "week"
  | "month"
  | "quarter"
  | "year";

type TypeTimeline = {
  dateRange: {from: Date; to: Date};
  annotationRange?: {from: Date; to: Date};
  data: TypeBarChartData;
  showArrows?: boolean;
  onPan?: (direction: "left" | "right", seconds: number) => void;
  onClickBar?: (date: Date) => void;
  onChangeDateRange?: (date: {from: Date; to: Date}) => void;
} & TypeFluidContainer;

const Timeline: FC<TypeTimeline> = ({
  dateRange,
  annotationRange,
  data,
  showArrows = true,
  onPan,
  onClickBar,
  onChangeDateRange,
  ...props
}) => {
  const chartRef = useRef<Chart<"bar", number[], string> | null>(null);

  const [startBarPosition, setStartBarPosition] = useState<TypeBarPosition>(null);
  const [endBarPosition, setEndBarPosition] = useState<TypeBarPosition>(null);

  const getUnit = (): TypeUnit => {
    const diffInMinutes = timeUtil.getDiffInMinutes(dateRange.from, dateRange.to);
    return timeUtil.unitMapper(diffInMinutes);
  };

  const handlePan = (direction: "left" | "right") => {
    const ticks = chartRef?.current?.scales.x.ticks;
    if (!ticks) return;
    const valueInPercent = ticks.length * 0.1;
    const timeUnit = getUnit();
    const seconds = valueInPercent * timeUtil.timeUnitsInSeconds[timeUnit];

    onPan?.(direction, seconds);
  };

  const handleClickBar = (event: MouseEvent) => {
    const chart = chartRef.current;
    if (!chart) return;

    const points = chart.getElementsAtEventForMode(event, "nearest", {intersect: true}, false);
    if (!points.length) return;

    const point = points[0];
    const xValueFrom = chart.data?.labels?.[point.index];
    if (!xValueFrom) return;

    onClickBar?.(new Date(xValueFrom));
  };

  const scales: TypeScales = {
    x: {
      type: "time",
      time: {
        unit: getUnit(),
        displayFormats: {
          [getUnit()]: "p"
        }
      },
      title: {
        display: false
      },
      grid: {
        display: false
      },
      border: {
        width: 3,
        color: "#d5e3fa"
      }
    },
    y: {
      title: {
        display: false
      },
      grid: {
        display: false
      },
      border: {
        width: 0
      },
      ticks: {
        padding: 10
      },
      offset: true,
      beginAtZero: true
    }
  };

  const plugins: TypePlugins = {
    legend: {
      display: false
    },
    annotation: {
      annotations: annotationRange
        ? {
            selectedBox: {
              type: "box",
              drawTime: "beforeDraw",
              xMin: annotationRange?.from.toISOString(),
              xMax: annotationRange?.to.toISOString(),
              backgroundColor: "#eaf0fd",
              borderWidth: 0
            }
          }
        : {}
    }
  };

  const options: any = {
    responsive: true,
    onClick: handleClickBar,
    scales,
    plugins
  };

  useEffect(() => {
    if (!chartRef.current?.scales.y.right) return;
    setStartBarPosition({x: chartRef.current?.scales.y.right, y: 30});
    setEndBarPosition({x: chartRef.current?.width, y: 30});
  }, []);

  const handleBarUp = (positionKey: TypeBarPosition, updateKey: "from" | "to") => {
    const scalesX = chartRef?.current?.scales?.x;
    const value = scalesX?.getValueForPixel(positionKey?.x || 0);
    if (!value) return;

    onChangeDateRange?.({
      ...dateRange,
      [updateKey]: new Date(value)
    });
  };

  const handleStartBarUp = () => handleBarUp(startBarPosition, "from");
  const handleEndBarUp = () => handleBarUp(endBarPosition, "to");

  return (
    <FluidContainer
      dimensionX="fill"
      alignment="top"
      gap={0}
      prefix={{
        children: showArrows && (
          <Button
            variant="filled"
            color="transparent"
            className={styles.pan}
            onClick={() => handlePan("left")}
          >
            <Icon name="chevronLeft" size={32} />
          </Button>
        )
      }}
      root={{
        dimensionX: "fill",
        dimensionY: "fill",
        children: (
          <FlexElement className={styles.container} dimensionX="fill" dimensionY={"fill"}>
            <Text className={`${styles.date} ${styles.from}`}>
              {timeUtil.formatDateToEnUs(dateRange.from)}
            </Text>
            {startBarPosition && (
              <DraggableBar
                x={startBarPosition.x}
                y={startBarPosition.y}
                minX={chartRef.current?.scales.y.right}
                maxX={endBarPosition?.x}
                height={chartRef.current?.scales.y.height}
                onChange={setStartBarPosition}
                onUp={handleStartBarUp}
              />
            )}
            <Bar ref={chartRef} options={options} data={data} />
            {endBarPosition && (
              <DraggableBar
                x={endBarPosition.x}
                y={endBarPosition.y}
                minX={startBarPosition?.x}
                maxX={chartRef.current?.width}
                height={chartRef.current?.scales.y.height}
                onChange={setEndBarPosition}
                onUp={handleEndBarUp}
              />
            )}
            <Text className={`${styles.date} ${styles.to}`}>
              {timeUtil.formatDateToEnUs(dateRange.to)}
            </Text>
          </FlexElement>
        )
      }}
      suffix={{
        children: showArrows && (
          <Button
            variant="filled"
            color="transparent"
            className={styles.pan}
            onClick={() => handlePan("right")}
          >
            <Icon name="chevronRight" size={32} />
          </Button>
        )
      }}
      {...props}
    />
  );
};

export default memo(Timeline);
