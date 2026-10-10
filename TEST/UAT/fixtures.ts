// UAT 测试数据夹具：与 UAT.md「3. 测试数据建议」的 sales.csv 一致。
// 8 行 5 列：城市/地区/季度 为文本，销售额/利润 为数值。

import type { ChartType, ChartWidget, Column, Dataset, WidgetEncoding } from "@/types";

/** sales.csv 数据集（城市 sum(销售额)：上海 250 / 北京 178 / 广州 156 / 深圳 195） */
export function salesDataset(): Dataset {
  const columns: Column[] = [
    { name: "城市", type: "string" },
    { name: "地区", type: "string" },
    { name: "季度", type: "string" },
    { name: "销售额", type: "number" },
    { name: "利润", type: "number" },
  ];
  const rows = [
    ["上海", "华东", "Q1", 120, 30],
    ["北京", "华北", "Q1", 90, 22],
    ["广州", "华南", "Q1", 80, 18],
    ["深圳", "华南", "Q2", 100, 25],
    ["上海", "华东", "Q2", 130, 33],
    ["北京", "华北", "Q2", 88, 20],
    ["广州", "华南", "Q2", 76, 17],
    ["深圳", "华南", "Q1", 95, 23],
  ];
  return {
    id: "ds_sales",
    name: "sales.csv",
    source: "csv",
    columns,
    rows,
    createdAt: "2026-10-11T00:00:00.000Z",
  };
}

export const DATASET_ID = "ds_sales";

/** 城市维度 + sum(销售额)（图表 A / UAT-HL-01 基准） */
export function cityEncoding(): WidgetEncoding {
  return { dimension: "城市", measures: [{ field: "销售额", agg: "sum" }] };
}

/** 地区维度 + sum(销售额)（图表 C / UAT-HL-15 字段不匹配） */
export function regionEncoding(): WidgetEncoding {
  return { dimension: "地区", measures: [{ field: "销售额", agg: "sum" }] };
}

/** 视觉对象工厂：默认按「城市 / sum(销售额)」分组，便于直接渲染 */
export function makeWidget(
  patch: Partial<ChartWidget> & { id: string; type: ChartType },
): ChartWidget {
  return {
    title: "",
    datasetId: DATASET_ID,
    encoding: cityEncoding(),
    layout: { x: 0, y: 0, w: 420, h: 280 },
    ...patch,
  };
}
