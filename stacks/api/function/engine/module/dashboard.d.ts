/**
 * Internal Dashboard module
 */
declare module "@internal/dashboard" {
  abstract class Component {
    abstract readonly type: string;
    abstract readonly target: string;
  }

  export class Charts extends Component {
    type: Charts.Type;
    target: string;
    key: string;
    constructor(target: string, key: string, type: Charts.Type);
  }
  export class Table extends Component {
    readonly type = "table";
    target: string;
    key: string;
    constructor(target: string, key: string);
  }

  namespace Table {
    export interface filter {
      key: string;
      title: string;
      type: "string" | "date" | "number";
      value: string;
    }
    export interface Data {
      title?: string;
      data: [];
      displayedColumns: string[];
      width?: number;
      filters?: filter[];
      paginate?: number[];
    }
    export interface Response {
      [key: string]: Data;
    }
  }

  namespace Charts {
    export type Type =
      | "line"
      | "bar"
      | "radar"
      | "pie"
      | "polarArea"
      | "doughnut"
      | "bubble"
      | "scatter";

    //Types
    export type SingleDataSet = number[] | ChartPoint[];
    export type MultiDataSet = (number[] | ChartPoint[])[];
    export type SingleOrMultiDataSet = SingleDataSet | MultiDataSet;
    export type SingleLineLabel = string;
    export type MultiLineLabel = string[];
    export type Label = SingleLineLabel | MultiLineLabel;
    export type ChartColor = string | CanvasGradient | CanvasPattern | string[];
    export type PositionType = "left" | "right" | "top" | "bottom" | "chartArea";

    type Scriptable<T> = (ctx: {
      dataIndex?: number;
      dataset?: ChartDataSets;
      datasetIndex?: number;
    }) => T;
    //Interfaces
    export interface ChartDataSets {
      data?: Array<number | null | undefined> | ChartPoint[];
      label?: string;
      showLine?: boolean;
      stack?: string;
      pointRadius?: number | number[] | Scriptable<number>;
      spanGaps?: boolean;
      weight?: number;
      lineTension?: number;
      maxBarThickness?: number;
      minBarLength?: number;
    }

    export interface Color {
      backgroundColor?: string | string[];
      borderWidth?: number | number[];
      borderColor?: string | string[];
      borderCapStyle?: string;
      borderDash?: number[];
      borderDashOffset?: number;
      borderJoinStyle?: string;
      pointBorderColor?: string | string[];
      pointBackgroundColor?: string | string[];
      pointBorderWidth?: number | number[];
      pointRadius?: number | number[];
      pointHoverRadius?: number | number[];
      pointHitRadius?: number | number[];
      pointHoverBackgroundColor?: string | string[];
      pointHoverBorderColor?: string | string[];
      pointHoverBorderWidth?: number | number[];
      pointStyle?: string | string[];
      hoverBackgroundColor?: string | string[];
      hoverBorderColor?: string | string[];
      hoverBorderWidth?: number;
    }
    export interface ChartPoint {
      x?: number | string | Date;
      y?: number | string | Date;
      r?: number;
      t?: number | string | Date;
    }

    export interface ChartLegendOptions {
      align?: "center" | "end" | "start";
      display?: boolean;
      fullWidth?: boolean;
      labels?: ChartLegendLabelOptions;
      reverse?: boolean;
    }
    export interface ChartLegendLabelOptions {
      boxWidth?: number;
      fontSize?: number;
      fontStyle?: string;
      fontColor?: ChartColor;
      fontFamily?: string;
      padding?: number;
      usePointStyle?: boolean;
    }

    export interface ChartTitleOptions {
      display?: boolean;
      position?: PositionType;
      fullWidth?: boolean;
      fontSize?: number;
      fontFamily?: string;
      fontColor?: ChartColor;
      fontStyle?: string;
      padding?: number;
      text?: string | string[];
    }

    type ScaleType = "category" | "linear" | "logarithmic" | "time" | "radialLinear";

    export interface GridLineOptions {
      display?: boolean;
      circular?: boolean;
      color?: ChartColor;
      borderDash?: number[];
      borderDashOffset?: number;
      lineWidth?: number | number[];
      drawBorder?: boolean;
      drawOnChartArea?: boolean;
      drawTicks?: boolean;
      tickMarkLength?: number;
      zeroLineWidth?: number;
      zeroLineColor?: ChartColor;
      zeroLineBorderDash?: number[];
      zeroLineBorderDashOffset?: number;
      offsetGridLines?: boolean;
    }

    export interface ChartLayoutPaddingObject {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    }

    export interface ScaleTitleOptions {
      display?: boolean;
      labelString?: string;
      lineHeight?: number | string;
      fontColor?: ChartColor;
      fontFamily?: string;
      fontSize?: number;
      fontStyle?: string;
      padding?: ChartLayoutPaddingObject | number;
    }

    export interface NestedTickOptions {
      autoSkip?: boolean;
      autoSkipPadding?: number;
      backdropColor?: ChartColor;
      backdropPaddingX?: number;
      backdropPaddingY?: number;
      beginAtZero?: boolean;
      callback?(value: any, index: any, values: any): string | number;
      display?: boolean;
      fontColor?: ChartColor;
      fontFamily?: string;
      fontSize?: number;
      fontStyle?: string;
      labelOffset?: number;
      lineHeight?: number;
      max?: any;
      maxRotation?: number;
      maxTicksLimit?: number;
      min?: any;
      minRotation?: number;
      mirror?: boolean;
      padding?: number;
      reverse?: boolean;
      showLabelBackdrop?: boolean;
      source?: "auto" | "data" | "labels";
      stepSize?: number;
      suggestedMax?: number;
      suggestedMin?: number;
    }

    export interface MajorTickOptions extends NestedTickOptions {
      enabled?: boolean;
    }

    export interface TickOptions extends NestedTickOptions {
      minor?: NestedTickOptions | false;
      major?: MajorTickOptions | false;
    }

    export interface CommonAxe {
      bounds?: string;
      type?: ScaleType | string;
      display?: boolean | string;
      id?: string;
      stacked?: boolean;
      position?: string;
      ticks?: TickOptions;
      gridLines?: GridLineOptions;
      scaleLabel?: ScaleTitleOptions;
      time?: TimeScale;
      offset?: boolean;
      beforeUpdate?(scale?: any): void;
      beforeSetDimension?(scale?: any): void;
      beforeDataLimits?(scale?: any): void;
      beforeBuildTicks?(scale?: any): void;
      beforeTickToLabelConversion?(scale?: any): void;
      beforeCalculateTickRotation?(scale?: any): void;
      beforeFit?(scale?: any): void;
      afterUpdate?(scale?: any): void;
      afterSetDimension?(scale?: any): void;
      afterDataLimits?(scale?: any): void;
      afterBuildTicks?(scale?: any): void;
      afterTickToLabelConversion?(scale?: any): void;
      afterCalculateTickRotation?(scale?: any): void;
      afterFit?(scale?: any): void;
    }

    export interface ChartYAxe extends CommonAxe {}

    export interface ChartXAxe extends CommonAxe {
      distribution?: "linear" | "series";
    }

    export interface ChartScales {
      type?: ScaleType | string;
      display?: boolean;
      position?: PositionType | string;
      gridLines?: GridLineOptions;
      scaleLabel?: ScaleTitleOptions;
      ticks?: TickOptions;
      xAxes?: ChartXAxe[];
      yAxes?: ChartYAxe[];
    }

    export interface LinearTickOptions extends TickOptions {
      maxTicksLimit?: number;
      stepSize?: number;
      precision?: number;
      suggestedMin?: number;
      suggestedMax?: number;
    }
    export interface LinearScale extends ChartScales {
      ticks?: LinearTickOptions;
    }
    export interface LogarithmicTickOptions extends TickOptions {}

    export interface LogarithmicScale extends ChartScales {
      ticks?: LogarithmicTickOptions;
    }

    type TimeUnit =
      | "millisecond"
      | "second"
      | "minute"
      | "hour"
      | "day"
      | "week"
      | "month"
      | "quarter"
      | "year";

    export interface TimeDisplayFormat {
      millisecond?: string;
      second?: string;
      minute?: string;
      hour?: string;
      day?: string;
      week?: string;
      month?: string;
      quarter?: string;
      year?: string;
    }

    export interface TimeScale extends ChartScales {
      displayFormats?: TimeDisplayFormat;
      isoWeekday?: boolean;
      max?: string;
      min?: string;
      parser?: string | ((arg: any) => any);
      round?: TimeUnit;
      tooltipFormat?: string;
      unit?: TimeUnit;
      unitStepSize?: number;
      stepSize?: number;
      minUnit?: TimeUnit;
    }

    export interface ChartOptions {
      responsive?: boolean;
      responsiveAnimationDuration?: number;
      aspectRatio?: number;
      maintainAspectRatio?: boolean;
      events?: string[];
      title?: ChartTitleOptions;
      legend?: ChartLegendOptions;
      showLines?: boolean;
      spanGaps?: boolean;
      scales?: ChartScales | LinearScale | LogarithmicScale | TimeScale;
      cutoutPercentage?: number;
      circumference?: number;
      rotation?: number;
      devicePixelRatio?: number;
    }
    export interface filter {
      key: string;
      title: string;
      type: "string" | "date" | "number";
      value: string;
    }

    //Data Interface
    export interface Data {
      title?: string;
      data?: SingleOrMultiDataSet;
      datasets?: ChartDataSets[];
      colors?: Color[];
      legend?: boolean;
      label: Label[];
      options?: ChartOptions;
      width?: number;
      filters: filter[];
    }

    //Response Interface
    export interface Response {
      [key: string]: Data;
    }
  }

  class Dashboard {
    constructor(key: string, name: string, icon: string);
    add(c: Component): this;
    static remove(dashboardKey: string): void;
  }
}
