// 全局数据模型定义（前端）。字段与 Rust 端 struct 对齐。

export type CellValue = string | number | boolean | null;

export type ColumnType = "string" | "number" | "boolean" | "date" | "unknown";

export interface Column {
  name: string;
  type: ColumnType;
}

export type DatasetSource = "csv" | "excel" | "sql";

export interface Dataset {
  id: string;
  name: string;
  source: DatasetSource;
  columns: Column[];
  rows: CellValue[][];
  createdAt: string;
}

/** SQL Server 连接配置（前端表单 / IPC 入参） */
export interface SqlServerConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  /** 是否要求加密连接 */
  encrypt: boolean;
}

/** 持久化到 .biproj 的连接信息（不含密码） */
export type PersistedConnection = Omit<SqlServerConfig, "password"> & {
  id: string;
  name: string;
};

/**
 * 运行时连接（含可选密码）。
 * 密码仅保存在内存中，默认不写入 .biproj；仅在用户勾选「包含密码」时才落盘。
 */
export interface SavedConnection extends PersistedConnection {
  password?: string;
}

export interface QueryColumn {
  name: string;
  type: string;
}

/** Rust 端执行 SQL 后返回的数据集 */
export interface QueryResult {
  columns: QueryColumn[];
  rows: CellValue[][];
}

export type ChartType =
  | "bar"
  | "stackedBar"
  | "stackedBar100"
  | "horizontalBar"
  | "horizontalStackedBar"
  | "line"
  | "area"
  | "stackedArea"
  | "combo"
  | "pie"
  | "donut"
  | "scatter"
  | "treemap"
  | "funnel"
  | "radialBar"
  | "table"
  | "kpi"
  | "map"
  | "matrix";

/** 填充地图使用的地理边界范围；auto 表示按数据自动识别 */
export type MapRegion = "auto" | "china" | "world";

export type AggregateFn = "sum" | "count" | "avg" | "min" | "max" | "none";

export interface Measure {
  field: string;
  agg: AggregateFn;
}

export interface WidgetEncoding {
  /** 维度 / x 轴 / 分类字段 */
  dimension?: string;
  /** 度量列表 */
  measures: Measure[];
  /** 分组 / 系列字段（可选） */
  series?: string;
}

/** 视觉对象在报告页上的绝对像素布局（左上角坐标 + 宽高） */
export interface WidgetLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ChartWidget {
  id: string;
  type: ChartType;
  title: string;
  datasetId: string;
  encoding: WidgetEncoding;
  layout: WidgetLayout;
  /** 是否在视觉对象顶部显示标题（默认显示） */
  showTitle?: boolean;
  /** 是否显示图例（默认显示） */
  showLegend?: boolean;
  /** 填充地图的地理范围（仅 type="map" 时使用，默认 auto） */
  mapRegion?: MapRegion;
  /** 数据透视表是否显示行/列总计（仅 type="matrix" 时使用，默认显示） */
  showTotals?: boolean;
}

export interface Dashboard {
  id: string;
  name: string;
  widgets: ChartWidget[];
}

/** .biproj 项目文件结构 */
export interface BiProject {
  version: number;
  connections: SavedConnection[];
  datasets: Dataset[];
  dashboards: Dashboard[];
}

/** v2：WidgetLayout 由网格单位改为像素坐标 */
export const PROJECT_VERSION = 2;
