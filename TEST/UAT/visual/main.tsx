/**
 * UAT 交叉高亮「可视化证据」截图页（仅供文档取证，不参与产品打包）。
 *
 * 用法：以 `?case=UAT-HL-XX` 打开，页面渲染该用例对应的真实组件
 * （ChartRenderer / ReportCanvas 卡片 / DashboardView 外壳）并呈现操作结果，
 * 由无头 Chrome 截图为 PNG 后嵌入 UAT-SUMMARY.md。
 *
 * 说明：Tailwind 的 content 未包含 TEST/，故页面外壳一律使用内联样式；
 * 图表卡片复用 src 中已出现、已生成的工具类，保证与产品内观感一致。
 */

import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "../../../src/index.css";
import { ChartRenderer } from "@/features/dashboard/ChartRenderer";
import { DashboardView } from "@/features/dashboard/DashboardView";
import { useDashboardStore } from "@/stores/dashboardStore";
import { useDatasetStore } from "@/stores/datasetStore";
import { autoTitle } from "@/lib/chart";
import type {
  ChartType,
  ChartWidget,
  Dashboard,
  WidgetEncoding,
} from "@/types";
import type { HighlightSelection } from "@/lib/highlight";
import { makeWidget, regionEncoding, salesDataset } from "../fixtures";

const DS = salesDataset();

/** 城市 / sum(销售额)（图表 A、B、C… 的默认编码） */
const cityEnc = (): WidgetEncoding => ({
  dimension: "城市",
  measures: [{ field: "销售额", agg: "sum" }],
});
/** 城市 / sum(销售额)、sum(利润)（双度量：堆叠图 / 组合图） */
const cityTwoEnc = (): WidgetEncoding => ({
  dimension: "城市",
  measures: [
    { field: "销售额", agg: "sum" },
    { field: "利润", agg: "sum" },
  ],
});

function W(
  id: string,
  type: ChartType,
  patch: Partial<ChartWidget> = {},
): ChartWidget {
  return makeWidget({ id, type, ...patch });
}

const hl = (
  field: string,
  values: string[],
  sourceId: string,
): HighlightSelection => ({ field, values, sourceId });

/* ------------------------------------------------------------------ */
/* 板（board）定义                                                      */
/* ------------------------------------------------------------------ */

interface WidgetBoard {
  kind: "widget";
  label?: string;
  widget: ChartWidget;
  highlight?: HighlightSelection | null;
  width?: number;
  height?: number;
}

type DashAction =
  | "blank-clear"
  | "escape-clear"
  | "switch-clear"
  | "delete-clear"
  | "no-persist";

interface DashBoard {
  kind: "dashboard";
  label?: string;
  action: DashAction;
  dashboards: Dashboard[];
  activeId: string;
  switchTo?: string;
}

type Board = WidgetBoard | DashBoard;

function wb(
  widget: ChartWidget,
  highlight: HighlightSelection | null = null,
  label?: string,
  width?: number,
  height?: number,
): WidgetBoard {
  return { kind: "widget", widget, highlight, label, width, height };
}

/* ------------------------------------------------------------------ */
/* 仪表盘外壳用例的数据预置                                             */
/* ------------------------------------------------------------------ */

const PIVOT_ID = "dash-pivot";

function dashWidgets(prefix: string): ChartWidget[] {
  return [
    W(prefix + "-bar", "bar", { layout: { x: 24, y: 24, w: 480, h: 300 } }),
    W(PIVOT_ID, "matrix", {
      layout: { x: 24, y: 348, w: 480, h: 320 },
    }),
  ];
}

const DASH_A: Dashboard = {
  id: "dash1",
  name: "仪表盘 1",
  widgets: dashWidgets("d1"),
};
const DASH_B: Dashboard = {
  id: "dash2",
  name: "仪表盘 2",
  widgets: [W("d2-bar", "bar", { layout: { x: 24, y: 24, w: 480, h: 300 } })],
};

/* ------------------------------------------------------------------ */
/* 用例注册表（28 条）                                                  */
/* ------------------------------------------------------------------ */

interface CaseDef {
  id: string;
  title: string;
  priority: "高" | "中" | "低";
  op: string;
  expect: string;
  boards: Board[];
  note?: string;
}

const CASES: Record<string, CaseDef> = {
  "UAT-HL-01": {
    id: "UAT-HL-01",
    title: "单选触发跨图表高亮",
    priority: "高",
    op: "在「城市柱状图」上点击『上海』柱。",
    expect:
      "上海保持实色，其余城市变暗至 25%；按「城市」分组的饼图同步响应；按「地区」分组的柱状图字段不匹配，保持全部实色。",
    boards: [
      wb(W("wA", "bar"), hl("城市", ["上海"], "wA"), "图表 A · 城市柱状图"),
      wb(W("wB", "pie"), hl("城市", ["上海"], "wA"), "图表 B · 城市饼图", 380, 280),
      wb(W("wC", "bar", { encoding: regionEncoding() }), hl("城市", ["上海"], "wA"), "图表 C · 地区柱状图（不受影响）"),
    ],
  },
  "UAT-HL-02": {
    id: "UAT-HL-02",
    title: "来源图表自身也变暗",
    priority: "高",
    op: "点击「城市柱状图」上的『上海』。",
    expect: "作为高亮来源的图表自身同样参与变暗：上海实色，北京/广州/深圳变为 25%。",
    boards: [wb(W("wA", "bar"), hl("城市", ["上海"], "wA"), "来源图表 · 城市柱状图")],
  },
  "UAT-HL-03": {
    id: "UAT-HL-03",
    title: "高亮不改变聚合与总计",
    priority: "高",
    op: "在「数据透视表」上点击『上海』行（进入 / 退出高亮各渲染一次）。",
    expect:
      "两次渲染的数值完全一致；行/列总计（含总计 967）保持不变，高亮仅改变透明度。",
    boards: [
      wb(W("m1", "matrix", { encoding: cityTwoEnc() }), null, "① 初始（无高亮）· 总计 967", 520, 320),
      wb(W("m1", "matrix", { encoding: cityTwoEnc() }), hl("城市", ["上海"], "m1"), "② 点击『上海』后（高亮）· 总计仍为 967", 520, 320),
    ],
  },
  "UAT-HL-04": {
    id: "UAT-HL-04",
    title: "再次点击同一元素清除高亮",
    priority: "高",
    op: "已高亮『上海』后，再次点击同一个『上海』柱。",
    expect: "再次点击唯一已选项即清除高亮，所有柱恢复实色。",
    boards: [
      wb(W("wA", "bar"), hl("城市", ["上海"], "wA"), "点击前（已高亮上海）"),
      wb(W("wA", "bar"), null, "再次点击『上海』后（高亮清除）"),
    ],
  },
  "UAT-HL-05": {
    id: "UAT-HL-05",
    title: "⌘/Ctrl 累加多选",
    priority: "中",
    op: "点击『上海』后，按住 ⌘（Windows 为 Ctrl）再点击『北京』。",
    expect: "上海、北京同时保持实色，广州、深圳变暗。",
    boards: [wb(W("wA", "bar"), hl("城市", ["上海", "北京"], "wA"), "⌘ 累加：上海 + 北京")],
  },
  "UAT-HL-06": {
    id: "UAT-HL-06",
    title: "⌘ 点击已选值将其移除",
    priority: "中",
    op: "在『上海 + 北京』高亮状态下，按 ⌘ 再次点击『北京』。",
    expect: "北京被移出选中集合，仅上海保持实色。",
    boards: [
      wb(W("wA", "bar"), hl("城市", ["上海", "北京"], "wA"), "操作前：上海 + 北京"),
      wb(W("wA", "bar"), hl("城市", ["上海"], "wA"), "⌘ 点击『北京』移除后：仅上海"),
    ],
  },
  "UAT-HL-07": {
    id: "UAT-HL-07",
    title: "⌘ 移除最后一个值后清除高亮",
    priority: "中",
    op: "在仅『上海』被选中的状态下，按 ⌘ 再次点击『上海』。",
    expect: "选中集合变空，高亮被整体清除。",
    boards: [
      wb(W("wA", "bar"), hl("城市", ["上海"], "wA"), "操作前：仅上海"),
      wb(W("wA", "bar"), null, "⌘ 移除『上海』后（高亮清除）"),
    ],
  },
  "UAT-HL-08": {
    id: "UAT-HL-08",
    title: "同源换值替换选中",
    priority: "高",
    op: "已高亮『上海』，直接点击『广州』（不带修饰键）。",
    expect: "非累加且换值 → 替换选中，广州实色，上海恢复实色。",
    boards: [
      wb(W("wA", "bar"), hl("城市", ["上海"], "wA"), "操作前：上海"),
      wb(W("wA", "bar"), hl("城市", ["广州"], "wA"), "点击『广州』换值后"),
    ],
  },
  "UAT-HL-09": {
    id: "UAT-HL-09",
    title: "换来源替换字段与来源",
    priority: "中",
    op: "已在「城市柱状图」高亮『上海』，改在「地区柱状图」上点击『华南』。",
    expect: "字段与来源整体替换：城市图恢复实色；地区图华南实色、华东/华北变暗。",
    boards: [
      wb(W("wA", "bar"), null, "原来源（城市图）→ 高亮被替换，恢复实色"),
      wb(W("wC", "bar", { encoding: regionEncoding() }), hl("地区", ["华南"], "wC"), "新来源（地区图）：华南实色，其余变暗"),
    ],
  },
  "UAT-HL-10": {
    id: "UAT-HL-10",
    title: "从另一图表点击同字段替换来源",
    priority: "低",
    op: "已在图表 A 高亮『上海』，改在图表 B（同为城市字段）点击『上海』。",
    expect: "来源 id 被替换为图表 B；因字段与取值相同，两图视觉一致（上海实色）。",
    boards: [
      wb(W("wA", "bar"), hl("城市", ["上海"], "wB"), "图表 A（来源已变为 wB）"),
      wb(W("wB", "bar"), hl("城市", ["上海"], "wB"), "图表 B（新的高亮来源）"),
    ],
  },
  "UAT-HL-11": {
    id: "UAT-HL-11",
    title: "点击空白清除",
    priority: "高",
    op: "先点击透视表『上海』行触发高亮，再点击画布空白处。",
    expect: "点击空白（工作区/报告页底色）清除高亮，柱状图恢复全部实色。",
    boards: [
      {
        kind: "dashboard",
        action: "blank-clear",
        dashboards: [DASH_A],
        activeId: "dash1",
        label: "真实仪表盘外壳 · 点击空白处后",
      },
    ],
  },
  "UAT-HL-12": {
    id: "UAT-HL-12",
    title: "Esc 清除",
    priority: "中",
    op: "先点击透视表『上海』行触发高亮，再按下 Esc 键。",
    expect: "Esc 清除高亮，柱状图恢复全部实色。",
    boards: [
      {
        kind: "dashboard",
        action: "escape-clear",
        dashboards: [DASH_A],
        activeId: "dash1",
        label: "真实仪表盘外壳 · 按下 Esc 后",
      },
    ],
  },
  "UAT-HL-13": {
    id: "UAT-HL-13",
    title: "切换仪表盘清除",
    priority: "中",
    op: "在「仪表盘 1」点击透视表『上海』行触发高亮，再切换到「仪表盘 2」。",
    expect: "切换仪表盘即清空高亮，新仪表盘不携带任何高亮残留。",
    boards: [
      {
        kind: "dashboard",
        action: "switch-clear",
        dashboards: [DASH_A, DASH_B],
        activeId: "dash1",
        switchTo: "仪表盘 2",
        label: "真实仪表盘外壳 · 切换至「仪表盘 2」后",
      },
    ],
  },
  "UAT-HL-14": {
    id: "UAT-HL-14",
    title: "删除来源图表清除",
    priority: "低",
    op: "点击透视表『上海』行触发高亮，再删除该来源图表（数据透视表）。",
    expect: "来源被删除后高亮一并清除，剩余柱状图恢复全部实色。",
    boards: [
      {
        kind: "dashboard",
        action: "delete-clear",
        dashboards: [DASH_A],
        activeId: "dash1",
        label: "真实仪表盘外壳 · 删除来源图表后（仅剩柱状图）",
      },
    ],
  },
  "UAT-HL-15": {
    id: "UAT-HL-15",
    title: "字段不匹配的图表不响应",
    priority: "高",
    op: "按「城市」高亮『上海』，观察按「地区」分组的图表。",
    expect: "地区图分组字段与选中字段不一致，所有区域保持实色（不响应）。",
    boards: [
      wb(W("wA", "bar"), hl("城市", ["上海"], "wA"), "按城市高亮：城市图响应"),
      wb(W("wC", "bar", { encoding: regionEncoding() }), hl("城市", ["上海"], "wA"), "按地区分组：全部实色（不响应）"),
    ],
  },
  "UAT-HL-16": {
    id: "UAT-HL-16",
    title: "无维度分组的图表点击不影响其它",
    priority: "低",
    op: "点击无维度分组的单柱图（聚合键为 __all__）。",
    expect: "其分组字段为 __all__，与「城市」不同，按城市分组的图表不受影响。",
    boards: [
      wb(
        W("wN", "bar", { encoding: { measures: [{ field: "销售额", agg: "sum" }] } }),
        null,
        "无维度图表（单柱，聚合键 __all__）",
      ),
      wb(W("wA", "bar"), hl("__all__", ["__all__"], "wN"), "城市图：字段不同，保持实色"),
    ],
  },
  "UAT-HL-17": {
    id: "UAT-HL-17",
    title: "分组柱状图",
    priority: "高",
    op: "点击簇状柱形图上的『上海』。",
    expect: "上海柱实色，其余城市柱变暗。",
    boards: [wb(W("w17", "bar"), hl("城市", ["上海"], "w17"), "簇状柱形图")],
  },
  "UAT-HL-18": {
    id: "UAT-HL-18",
    title: "堆叠柱状图 / 100% 堆叠柱状图",
    priority: "中",
    op: "在两图上点击『上海』（双度量：销售额、利润）。",
    expect: "两种堆叠柱形图中，上海两段均实色，其余城市各段变暗。",
    boards: [
      wb(W("w18a", "stackedBar", { encoding: cityTwoEnc() }), hl("城市", ["上海"], "w18a"), "堆积柱形图"),
      wb(W("w18b", "stackedBar100", { encoding: cityTwoEnc() }), hl("城市", ["上海"], "w18b"), "100% 堆积柱形图"),
    ],
  },
  "UAT-HL-19": {
    id: "UAT-HL-19",
    title: "水平柱状图 / 水平堆叠柱状图",
    priority: "中",
    op: "在两种水平柱形图上点击『上海』。",
    expect: "水平布局下高亮同样生效：上海实色，其余变暗。",
    boards: [
      wb(W("w19a", "horizontalBar", { encoding: cityTwoEnc() }), hl("城市", ["上海"], "w19a"), "条形图"),
      wb(W("w19b", "horizontalStackedBar", { encoding: cityTwoEnc() }), hl("城市", ["上海"], "w19b"), "堆积条形图"),
    ],
  },
  "UAT-HL-20": {
    id: "UAT-HL-20",
    title: "组合图（柱 + 线）",
    priority: "低",
    op: "点击组合图中的『上海』柱。",
    expect: "仅首个度量的柱形图元参与变暗，折线图元不参与。",
    boards: [wb(W("w20", "combo", { encoding: cityTwoEnc() }), hl("城市", ["上海"], "w20"), "折线与柱形图")],
  },
  "UAT-HL-21": {
    id: "UAT-HL-21",
    title: "饼图 / 环形图",
    priority: "高",
    op: "在饼图与环形图上点击『上海』扇区。",
    expect: "上海扇区实色，其余扇区变暗。",
    boards: [
      wb(W("w21a", "pie"), hl("城市", ["上海"], "w21a"), "饼图", 380, 280),
      wb(W("w21b", "donut"), hl("城市", ["上海"], "w21b"), "环形图", 380, 280),
    ],
  },
  "UAT-HL-22": {
    id: "UAT-HL-22",
    title: "树状图",
    priority: "中",
    op: "在树状图上点击『上海』区块。",
    expect: "上海区块实色，其余区块变暗。",
    boards: [wb(W("w22", "treemap"), hl("城市", ["上海"], "w22"), "树状图")],
  },
  "UAT-HL-23": {
    id: "UAT-HL-23",
    title: "漏斗图",
    priority: "中",
    op: "在漏斗图上点击『上海』层。",
    expect: "上海层实色，其余层变暗。",
    boards: [wb(W("w23", "funnel"), hl("城市", ["上海"], "w23"), "漏斗图")],
  },
  "UAT-HL-24": {
    id: "UAT-HL-24",
    title: "径向条形图",
    priority: "中",
    op: "在径向条形图上点击『上海』扇环。",
    expect: "上海扇环实色，其余扇环变暗。",
    boards: [wb(W("w24", "radialBar"), hl("城市", ["上海"], "w24"), "径向条形图")],
  },
  "UAT-HL-25": {
    id: "UAT-HL-25",
    title: "地图区域",
    priority: "中",
    op: "在「填充地图」上点击『上海』区域。",
    expect: "上海实色；有数据但未命中的区域变暗；无数据区域（如天津）保持不透明且不可点击。",
    boards: [
      wb(
        W("w25", "map", { mapRegion: "china" }),
        hl("城市", ["上海"], "w25"),
        "填充地图（中国）· 上海高亮",
        520,
        400,
      ),
    ],
  },
  "UAT-HL-26": {
    id: "UAT-HL-26",
    title: "数据透视表行",
    priority: "中",
    op: "点击数据透视表的『上海』行。",
    expect: "上海行不透明，其余行变暗至 25%；底部合计行不参与高亮且不可点击。",
    boards: [wb(W("m26", "matrix"), hl("城市", ["上海"], "m26"), "数据透视表 · 点击『上海』行", 520, 320)],
  },
  "UAT-HL-27": {
    id: "UAT-HL-27",
    title: "不支持变暗的视觉对象不响应",
    priority: "中",
    op: "在存在高亮（城市=上海）时，观察折线/面积/堆叠面积/散点/表格/数值卡。",
    expect: "这些视觉对象不产生可高亮图元，保持原样、不发生变暗。",
    note: "折线 / 面积 / 堆叠面积 / 散点 / 表格 / 数值卡 六类均无变暗。",
    boards: [
      wb(W("w27-line", "line"), hl("城市", ["上海"], "wA"), "折线图", 300, 200),
      wb(W("w27-area", "area"), hl("城市", ["上海"], "wA"), "面积图", 300, 200),
      wb(W("w27-sarea", "stackedArea", { encoding: cityTwoEnc() }), hl("城市", ["上海"], "wA"), "堆积面积图", 300, 200),
      wb(
        W("w27-sc", "scatter", { encoding: { dimension: "销售额", measures: [{ field: "销售额", agg: "sum" }] } }),
        hl("城市", ["上海"], "wA"),
        "散点图",
        300,
        200,
      ),
      wb(W("w27-tb", "table"), hl("城市", ["上海"], "wA"), "表格", 300, 200),
      wb(W("w27-kpi", "kpi"), hl("城市", ["上海"], "wA"), "数值卡", 300, 200),
    ],
  },
  "UAT-HL-28": {
    id: "UAT-HL-28",
    title: "高亮不写入项目文件",
    priority: "高",
    op: "高亮『上海』后，序列化仪表盘状态（模拟保存 .biproj）。",
    expect: "序列化结果中不含任何 highlight 字段；重新挂载后无高亮残留。",
    boards: [
      {
        kind: "dashboard",
        action: "no-persist",
        dashboards: [DASH_A],
        activeId: "dash1",
        label: "真实仪表盘外壳 · 序列化取证",
      },
    ],
  },
};

/* ------------------------------------------------------------------ */
/* 渲染：图表卡片 / 仪表盘外壳                                          */
/* ------------------------------------------------------------------ */

const CHART_CARD =
  "group relative flex flex-col rounded-md border bg-background shadow-sm";
const CHART_TITLE =
  "pointer-events-none absolute left-2 top-1.5 z-10 max-w-[calc(100%-4rem)] truncate text-xs font-medium text-foreground/70";
const CHART_BODY = "min-h-0 flex-1 overflow-hidden p-2 pt-6";

function WidgetBoardView({ board }: { board: WidgetBoard }) {
  const { widget } = board;
  const width = board.width ?? 420;
  const height = board.height ?? 280;
  const showTitle = widget.showTitle ?? true;
  const title = widget.title.trim() || autoTitle(widget.encoding);
  return (
    <div className={CHART_CARD} style={{ width, height }}>
      {showTitle && title ? <div className={CHART_TITLE}>{title}</div> : null}
      <div className={CHART_BODY}>
        <ChartRenderer
          widget={widget}
          dataset={DS}
          highlight={board.highlight ?? null}
        />
      </div>
    </div>
  );
}

/** 读取当前页面中柱形图元的 fill-opacity，用于呈现运行时可测量证据 */
function barOpacities(): string[] {
  return Array.from(
    document.querySelectorAll("path.recharts-rectangle"),
  ).map((p) => p.getAttribute("fill-opacity") ?? "1");
}

function fmt(list: string[] | null): string {
  return list && list.length ? `[${list.join(", ")}]` : "—";
}

const DASH_W = 1180;
const DASH_H = 800;

function DashStage({ board }: { board: DashBoard }) {
  const [phase, setPhase] = useState("初始化…");
  const [before, setBefore] = useState<string[] | null>(null);
  const [after, setAfter] = useState<string[] | null>(null);
  const [persisted, setPersisted] = useState<string>("");

  useEffect(() => {
    useDatasetStore.setState({ datasets: [DS] });
    useDashboardStore.setState({
      dashboards: board.dashboards,
      activeId: board.activeId,
    });

    const timers: number[] = [];
    const at = (ms: number, fn: () => void) =>
      timers.push(window.setTimeout(fn, ms));

    if (board.action === "no-persist") {
      const snap = useDashboardStore.getState().dashboards;
      setPersisted(JSON.stringify({ version: 2, dashboards: snap }, null, 2));
      setPhase("已序列化仪表盘状态（模拟 .biproj 保存）");
      return () => timers.forEach((t) => clearTimeout(t));
    }

    // 1) 点击透视表『上海』行 → 触发交叉高亮
    at(600, () => {
      const tr = Array.from(document.querySelectorAll("tbody tr")).find(
        (r) => (r.querySelector("th")?.textContent ?? "").trim() === "上海",
      );
      if (tr) {
        tr.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        setPhase("① 已点击透视表『上海』行，触发交叉高亮");
      } else {
        setPhase("① 未找到透视表行");
      }
    });
    at(950, () => setBefore(barOpacities()));

    // 2) 执行清除动作
    at(1250, () => {
      if (board.action === "blank-clear") {
        const ws = document.querySelector(
          '[class*="bg-muted/40"]',
        ) as HTMLElement | null;
        ws?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        setPhase("② 已点击画布空白处");
      } else if (board.action === "escape-clear") {
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
        setPhase("② 已按下 Esc 键");
      } else if (board.action === "switch-clear") {
        const btn = Array.from(document.querySelectorAll("button")).find(
          (b) => (b.textContent ?? "").trim() === board.switchTo,
        );
        btn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        setPhase('② 已切换至「仪表盘 2」');
      } else if (board.action === "delete-clear") {
        const btns = document.querySelectorAll('[aria-label="删除图表"]');
        const target = btns[btns.length - 1] as HTMLElement | undefined;
        target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        setPhase("② 已删除来源图表（数据透视表）");
      }
    });
    at(1650, () => setAfter(barOpacities()));

    return () => timers.forEach((t) => clearTimeout(t));
  }, [board]);

  const actionLabel: Record<DashAction, string> = {
    "blank-clear": "点击画布空白处",
    "escape-clear": "按下 Esc 键",
    "switch-clear": "切换仪表盘",
    "delete-clear": "删除来源图表",
    "no-persist": "序列化仪表盘状态（模拟保存 .biproj）",
  };

  return (
    <>
      <div
        style={{
          width: DASH_W,
          height: DASH_H,
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          overflow: "hidden",
          background: "#fff",
        }}
      >
        <DashboardView />
      </div>

      <div
        style={{
          width: DASH_W,
          marginTop: 12,
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          background: "#fff",
          padding: "12px 16px",
          fontSize: 13,
          lineHeight: 1.7,
          color: "#0f172a",
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6 }}>运行时证据</div>
        <div>操作：先点击透视表『上海』行触发高亮 → 再{actionLabel[board.action]}。</div>
        <div>状态：{phase}</div>
        {board.action === "no-persist" ? (
          <>
            <div style={{ marginTop: 6 }}>
              序列化结果是否含 highlight：{" "}
              <b style={{ color: persisted.includes("highlight") ? "#dc2626" : "#16a34a" }}>
                {persisted.includes("highlight") ? "是（异常）" : "否（符合预期）"}
              </b>
            </div>
            <pre
              style={{
                marginTop: 8,
                maxHeight: 220,
                overflow: "auto",
                background: "#0f172a",
                color: "#e2e8f0",
                borderRadius: 6,
                padding: "10px 12px",
                fontSize: 11.5,
                lineHeight: 1.5,
              }}
            >
              {persisted}
            </pre>
          </>
        ) : (
          <div style={{ marginTop: 6 }}>
            柱状图 fill-opacity：
            <span style={{ marginLeft: 6 }}>
              高亮时 <b>{fmt(before)}</b> → 清除后{" "}
              <b style={{ color: "#16a34a" }}>{fmt(after)}</b>
            </span>
            <div style={{ color: "#64748b" }}>
              说明：进入高亮时未命中柱变为 0.25；清除后全部恢复 1。
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 页面外壳                                                            */
/* ------------------------------------------------------------------ */

const PRIORITY_COLOR: Record<string, string> = {
  高: "#dc2626",
  中: "#ea580c",
  低: "#0891b2",
};

function renderBoard(board: Board, i: number) {
  if (board.kind === "widget") {
    return (
      <figure key={i} style={{ margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {board.label ? (
          <figcaption
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: "#334155",
              paddingLeft: 2,
            }}
          >
            {board.label}
          </figcaption>
        ) : null}
        <WidgetBoardView board={board} />
      </figure>
    );
  }
  return (
    <figure key={i} style={{ margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
      {board.label ? (
        <figcaption
          style={{ fontSize: 12.5, fontWeight: 600, color: "#334155", paddingLeft: 2 }}
        >
          {board.label}
        </figcaption>
      ) : null}
      <DashStage board={board} />
    </figure>
  );
}

function App() {
  const id = new URLSearchParams(window.location.search).get("case") ?? "";
  const c = CASES[id];

  if (!c) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h2>未知用例：{id || "(空)"}</h2>
        <ul>
          {Object.keys(CASES).map((k) => (
            <li key={k}>
              <a href={`?case=${k}`}>{k}</a>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  useEffect(() => {
    document.title = `${c.id} · ${c.title}`;
  }, [c]);

  const isDash = c.boards.some((b) => b.kind === "dashboard");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: "20px 24px 32px",
        fontFamily:
          'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
        boxSizing: "border-box",
      }}
    >
      <header
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          padding: "16px 20px",
          marginBottom: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: "#0f172a" }}>{c.id}</span>
          <span style={{ fontSize: 16, color: "#334155" }}>{c.title}</span>
          <span
            style={{
              fontSize: 12,
              color: "#fff",
              background: PRIORITY_COLOR[c.priority],
              borderRadius: 999,
              padding: "1px 10px",
            }}
          >
            优先级 {c.priority}
          </span>
        </div>
        <div style={{ marginTop: 10, fontSize: 13.5, color: "#334155", lineHeight: 1.8 }}>
          <div>
            <b>操作：</b>
            {c.op}
          </div>
          <div>
            <b>预期：</b>
            {c.expect}
          </div>
          {c.note ? (
            <div style={{ color: "#64748b" }}>
              <b>说明：</b>
              {c.note}
            </div>
          ) : null}
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
          图例：实色（opacity 1）= 命中或字段无关；浅淡（opacity 0.25）= 同字段未命中的变暗项。
        </div>
      </header>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 20,
          alignItems: "flex-start",
          flexDirection: isDash ? "column" : "row",
        }}
      >
        {c.boards.map(renderBoard)}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />);
