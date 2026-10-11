/**
 * README 界面截图页（仅供文档取证，不参与产品打包）。
 *
 * 用法：以 `?view=datasource` 或 `?view=dashboard` 打开，页面渲染**真实的
 * App 外壳**（左侧导航 + 顶栏 + 数据源/仪表盘视图），并通过预置 store 呈现
 * 一份带数据的典型状态；由无头 Chrome 截图为 PNG 后嵌入根目录 README.md。
 *
 * 说明：Tailwind 的 content 未包含 TEST/，故此处不写任何依赖 Tailwind 的自定义
 * 外壳；渲染的均为 src 中已出现、已生成的类，保证与产品内观感完全一致。
 */

import { createRoot } from "react-dom/client";
import "../../src/index.css";
import App from "@/App";
import { useDatasetStore } from "@/stores/datasetStore";
import { useDashboardStore } from "@/stores/dashboardStore";
import { useViewStore, type ViewKey } from "@/stores/viewStore";
import type { ChartWidget, Dataset, WidgetEncoding } from "@/types";

/* ------------------------------------------------------------------ */
/* 预置数据                                                             */
/* ------------------------------------------------------------------ */

/** 销售明细（csv）：5 城市 × 4 季度 = 20 行；销售额合计 2000、利润合计 480 */
function salesDataset(): Dataset {
  const cities: Array<[string, string]> = [
    ["上海", "华东"],
    ["北京", "华北"],
    ["广州", "华南"],
    ["深圳", "华南"],
    ["成都", "西南"],
  ];
  const base: Record<string, number[][]> = {
    上海: [
      [120, 30],
      [130, 33],
      [145, 36],
      [160, 40],
    ],
    北京: [
      [90, 22],
      [88, 20],
      [95, 24],
      [110, 28],
    ],
    广州: [
      [80, 18],
      [76, 17],
      [84, 19],
      [92, 21],
    ],
    深圳: [
      [95, 23],
      [100, 25],
      [108, 27],
      [118, 30],
    ],
    成都: [
      [70, 15],
      [74, 16],
      [79, 17],
      [86, 19],
    ],
  };
  const quarters = ["Q1", "Q2", "Q3", "Q4"];
  const rows: Array<Array<string | number>> = [];
  for (const [city, region] of cities) {
    quarters.forEach((q, i) => {
      const [sales, profit] = base[city][i];
      rows.push([city, region, q, sales, profit]);
    });
  }
  return {
    id: "ds_sales",
    name: "销售明细.csv",
    source: "csv",
    columns: [
      { name: "城市", type: "string" },
      { name: "地区", type: "string" },
      { name: "季度", type: "string" },
      { name: "销售额", type: "number" },
      { name: "利润", type: "number" },
    ],
    rows,
    createdAt: "2026-10-11T00:00:00.000Z",
  };
}

/** 订单明细（excel）：用于在数据源列表中呈现 CSV / Excel 两种来源 */
function ordersDataset(): Dataset {
  return {
    id: "ds_orders",
    name: "订单明细.xlsx",
    source: "excel",
    columns: [
      { name: "订单号", type: "string" },
      { name: "客户", type: "string" },
      { name: "地区", type: "string" },
      { name: "金额", type: "number" },
      { name: "下单日期", type: "date" },
    ],
    rows: [
      ["SO-1001", "华宇科技", "华东", 12800, "2026-01-12"],
      ["SO-1002", "北方实业", "华北", 9600, "2026-01-18"],
      ["SO-1003", "岭南贸易", "华南", 15400, "2026-02-03"],
      ["SO-1004", "锦官集团", "西南", 7300, "2026-02-15"],
      ["SO-1005", "浦江信息", "华东", 18900, "2026-03-01"],
      ["SO-1006", "燕京物流", "华北", 8200, "2026-03-09"],
    ],
    createdAt: "2026-10-11T00:00:00.000Z",
  };
}

/* ------------------------------------------------------------------ */
/* 预置仪表盘：数值卡 + 柱形图 / 环形图 / 填充地图 / 折线图 / 数据透视表  */
/* ------------------------------------------------------------------ */

const SALES = "ds_sales";

const sum = (field: string) => ({ field, agg: "sum" as const });
const avg = (field: string) => ({ field, agg: "avg" as const });

function enc(
  dimension: string | undefined,
  measures: WidgetEncoding["measures"],
): WidgetEncoding {
  return dimension ? { dimension, measures } : { measures };
}

/** 画布内容宽约 1056px：三列（各 344，间距 12）+ 两列（各 520，间距 16） */
function widget(
  id: string,
  type: ChartWidget["type"],
  title: string,
  encoding: WidgetEncoding,
  layout: ChartWidget["layout"],
  patch: Partial<ChartWidget> = {},
): ChartWidget {
  return {
    id,
    type,
    title,
    datasetId: SALES,
    encoding,
    layout,
    ...patch,
  };
}

const DASHBOARD_WIDGETS: ChartWidget[] = [
  widget("kpi-sales", "kpi", "总销售额", enc(undefined, [sum("销售额")]), {
    x: 0,
    y: 0,
    w: 344,
    h: 130,
  }),
  widget("kpi-profit", "kpi", "总利润", enc(undefined, [sum("利润")]), {
    x: 356,
    y: 0,
    w: 344,
    h: 130,
  }),
  widget("kpi-avg", "kpi", "平均销售额", enc(undefined, [avg("销售额")]), {
    x: 712,
    y: 0,
    w: 344,
    h: 130,
  }),
  widget(
    "bar-city",
    "bar",
    "各城市销售额",
    enc("城市", [sum("销售额")]),
    { x: 0, y: 146, w: 344, h: 320 },
    { showLegend: false },
  ),
  widget(
    "donut-region",
    "donut",
    "地区销售占比",
    enc("地区", [sum("销售额")]),
    { x: 356, y: 146, w: 344, h: 320 },
  ),
  widget(
    "map-city",
    "map",
    "城市销售分布",
    enc("城市", [sum("销售额")]),
    { x: 712, y: 146, w: 344, h: 320 },
    { mapRegion: "china" },
  ),
  widget(
    "line-quarter",
    "line",
    "季度销售趋势",
    enc("季度", [sum("销售额")]),
    { x: 0, y: 482, w: 520, h: 320 },
    { showLegend: false },
  ),
  widget(
    "matrix-city",
    "matrix",
    "城市销售与利润",
    enc("城市", [sum("销售额"), sum("利润")]),
    { x: 536, y: 482, w: 520, h: 320 },
  ),
];

const DASHBOARD = {
  id: "dash_readme",
  name: "销售总览",
  widgets: DASHBOARD_WIDGETS,
};

/* ------------------------------------------------------------------ */
/* 预置 store 并渲染真实 App 外壳                                        */
/* ------------------------------------------------------------------ */

const params = new URLSearchParams(window.location.search);
const view: ViewKey = params.get("view") === "dashboard" ? "dashboard" : "datasource";

useDatasetStore.setState({ datasets: [salesDataset(), ordersDataset()] });
useViewStore.setState({ view });
if (view === "dashboard") {
  useDashboardStore.setState({
    dashboards: [DASHBOARD],
    activeId: DASHBOARD.id,
  });
}

document.title = view === "dashboard" ? "TinyBI · 仪表盘" : "TinyBI · 数据源";

createRoot(document.getElementById("root") as HTMLElement).render(<App />);
