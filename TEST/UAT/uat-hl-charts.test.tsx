// UAT 组件层脚本：图表渲染的交叉高亮表现。
// 覆盖 UAT-HL-17~24（各图表类型逐图元变暗/可点击）、UAT-HL-02（来源图表不豁免）、
// UAT-HL-15（字段不匹配不响应）、UAT-HL-27（不支持变暗的类型不响应）。
//
// 说明：jsdom 无布局引擎，Recharts 无法真实测量尺寸。此处将 Recharts 基础组件替换为
// 轻量替身，把每个 <Cell> 渲染成可断言的 DOM 节点，从而精确校验
// ChartRenderer 对 fill-opacity / onClick 的接线；真实图形渲染需在 Tauri 原生窗口验收。
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { DIM_OPACITY, type HighlightSelection } from "@/lib/highlight";
import type { ChartWidget, WidgetEncoding } from "@/types";
import { cityEncoding, regionEncoding, salesDataset, makeWidget } from "./fixtures";

vi.mock("recharts", async () => {
  const React = await import("react");
  const Box = ({ children }: { children?: unknown }) =>
    React.createElement("div", null, children as never);
  const Empty = () => null;
  /** 每个图元渲染为可断言节点：暴露 fill-opacity / class / 点击回调 */
  const Cell = (props: Record<string, unknown>) =>
    React.createElement("div", {
      "data-testid": "point",
      "data-fill": String(props.fill),
      "data-opacity": String(props.fillOpacity),
      className: props.className as string | undefined,
      onClick: props.onClick as never,
    });
  return {
    ResponsiveContainer: Box,
    BarChart: Box,
    ComposedChart: Box,
    PieChart: Box,
    LineChart: Box,
    AreaChart: Box,
    ScatterChart: Box,
    Treemap: Box,
    FunnelChart: Box,
    RadialBarChart: Box,
    Bar: Box,
    Pie: Box,
    Funnel: Box,
    RadialBar: Box,
    Line: Empty,
    Area: Empty,
    Scatter: Empty,
    Cell,
    XAxis: Empty,
    YAxis: Empty,
    CartesianGrid: Empty,
    Tooltip: Empty,
    Legend: Empty,
  };
});

import { ChartRenderer } from "@/features/dashboard/ChartRenderer";

const ds = salesDataset();

const HL_SHANGHAI: HighlightSelection = {
  field: "城市",
  values: ["上海"],
  sourceId: "wA",
};

function renderWidget(
  widget: ChartWidget,
  highlight: HighlightSelection | null = null,
  onPointClick?: (field: string, value: string, additive: boolean) => void,
) {
  return render(
    <ChartRenderer
      widget={widget}
      dataset={ds}
      highlight={highlight}
      onPointClick={onPointClick}
    />,
  );
}

function points(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-testid="point"]'));
}

/** 读取每个图元的 fill-opacity */
function opacities(container: HTMLElement): string[] {
  return points(container).map((p) => p.dataset.opacity ?? "");
}

afterEach(() => cleanup());

describe("UAT-HL-17 分组柱状图", () => {
  it("每根柱可点击；未选中柱变暗，选中柱不变", () => {
    const onPointClick = vi.fn();
    const { container } = renderWidget(
      makeWidget({ id: "wA", type: "bar" }),
      HL_SHANGHAI,
      onPointClick,
    );
    // 顺序：上海 / 北京 / 广州 / 深圳
    expect(opacities(container)).toEqual(["1", "0.25", "0.25", "0.25"]);
    const pts = points(container);
    expect(pts[0]).toHaveClass("cursor-pointer");

    fireEvent.click(pts[1]);
    expect(onPointClick).toHaveBeenCalledWith("城市", "北京", false);
  });
});

describe("UAT-HL-02 来源图表自身也变暗", () => {
  it("来源视觉对象的未选中项同样变暗（不豁免）", () => {
    const { container } = renderWidget(
      makeWidget({ id: "wA", type: "bar" }),
      HL_SHANGHAI,
    );
    expect(opacities(container)).toEqual(["1", "0.25", "0.25", "0.25"]);
  });
});

describe("UAT-HL-15 字段不匹配的图表不响应", () => {
  it("「地区」分组图表在城市高亮下全部保持不透明", () => {
    const { container } = renderWidget(
      makeWidget({ id: "wC", type: "bar", encoding: regionEncoding() }),
      HL_SHANGHAI,
    );
    expect(opacities(container)).toEqual(["1", "1", "1"]);
  });
});

describe("UAT-HL-18 堆叠柱状图 / 100% 堆积柱状图", () => {
  const stacked: WidgetEncoding = {
    ...cityEncoding(),
    series: "季度",
  };

  it("堆叠柱：同一分类的各堆叠段一致处理", () => {
    const { container } = renderWidget(
      makeWidget({ id: "wS", type: "stackedBar", encoding: stacked }),
      HL_SHANGHAI,
    );
    // 两个系列（Q1/Q2）× 4 城市 = 8 段；上海（下标 0、4）不透明，其余变暗
    expect(opacities(container)).toEqual([
      "1",
      "0.25",
      "0.25",
      "0.25",
      "1",
      "0.25",
      "0.25",
      "0.25",
    ]);
  });

  it("100% 堆积柱：归一化后按分类一致处理", () => {
    const { container } = renderWidget(
      makeWidget({ id: "wS100", type: "stackedBar100", encoding: stacked }),
      HL_SHANGHAI,
    );
    expect(opacities(container)).toEqual([
      "1",
      "0.25",
      "0.25",
      "0.25",
      "1",
      "0.25",
      "0.25",
      "0.25",
    ]);
  });
});

describe("UAT-HL-19 水平柱状图 / 水平堆叠柱状图", () => {
  it("水平柱状图：与柱状图一致的变暗行为", () => {
    const { container } = renderWidget(
      makeWidget({ id: "wH", type: "horizontalBar" }),
      HL_SHANGHAI,
    );
    expect(opacities(container)).toEqual(["1", "0.25", "0.25", "0.25"]);
  });

  it("水平堆叠柱状图：按分类整段一致处理", () => {
    const { container } = renderWidget(
      makeWidget({
        id: "wHS",
        type: "horizontalStackedBar",
        encoding: { ...cityEncoding(), series: "季度" },
      }),
      HL_SHANGHAI,
    );
    expect(opacities(container)).toEqual([
      "1",
      "0.25",
      "0.25",
      "0.25",
      "1",
      "0.25",
      "0.25",
      "0.25",
    ]);
  });
});

describe("UAT-HL-20 组合图（柱 + 线）", () => {
  it("柱部分可点击且可变暗；线部分不参与变暗", () => {
    const onPointClick = vi.fn();
    const { container } = renderWidget(
      makeWidget({
        id: "wCombo",
        type: "combo",
        encoding: {
          dimension: "城市",
          measures: [
            { field: "销售额", agg: "sum" },
            { field: "利润", agg: "sum" },
          ],
        },
      }),
      HL_SHANGHAI,
      onPointClick,
    );
    // 仅柱（首个度量）生成图元；线不生成可断言图元
    expect(opacities(container)).toEqual(["1", "0.25", "0.25", "0.25"]);
    fireEvent.click(points(container)[2]);
    expect(onPointClick).toHaveBeenCalledWith("城市", "广州", false);
  });
});

describe("UAT-HL-21 饼图 / 环形图", () => {
  it("饼图：未选中扇区变暗，选中扇区不变", () => {
    const { container } = renderWidget(
      makeWidget({ id: "wPie", type: "pie" }),
      HL_SHANGHAI,
    );
    expect(opacities(container)).toEqual(["1", "0.25", "0.25", "0.25"]);
  });

  it("环形图：行为与饼图一致", () => {
    const onPointClick = vi.fn();
    const { container } = renderWidget(
      makeWidget({ id: "wDonut", type: "donut" }),
      HL_SHANGHAI,
      onPointClick,
    );
    expect(opacities(container)).toEqual(["1", "0.25", "0.25", "0.25"]);
    fireEvent.click(points(container)[0]);
    expect(onPointClick).toHaveBeenCalledWith("城市", "上海", false);
  });
});

describe("UAT-HL-22 树状图", () => {
  it("未选中块变暗", () => {
    const { container } = renderWidget(
      makeWidget({ id: "wTree", type: "treemap" }),
      HL_SHANGHAI,
    );
    expect(opacities(container)).toEqual(["1", "0.25", "0.25", "0.25"]);
  });
});

describe("UAT-HL-23 漏斗图", () => {
  it("未选中层变暗", () => {
    const { container } = renderWidget(
      makeWidget({ id: "wFunnel", type: "funnel" }),
      HL_SHANGHAI,
    );
    expect(opacities(container)).toEqual(["1", "0.25", "0.25", "0.25"]);
  });
});

describe("UAT-HL-24 径向条形图", () => {
  it("未选中径向条变暗", () => {
    const { container } = renderWidget(
      makeWidget({ id: "wRadial", type: "radialBar" }),
      HL_SHANGHAI,
    );
    expect(opacities(container)).toEqual(["1", "0.25", "0.25", "0.25"]);
  });
});

describe("UAT-HL-27 不支持变暗的视觉对象不响应", () => {
  it("折线图不产生可点击/可变暗图元", () => {
    const onPointClick = vi.fn();
    const { container } = renderWidget(
      makeWidget({ id: "wLine", type: "line" }),
      HL_SHANGHAI,
      onPointClick,
    );
    expect(points(container)).toHaveLength(0);
    expect(onPointClick).not.toHaveBeenCalled();
  });

  it("面积图 / 堆叠面积图 / 散点图不产生图元", () => {
    for (const type of ["area", "stackedArea", "scatter"] as const) {
      const { container, unmount } = renderWidget(
        makeWidget({ id: `w-${type}`, type }),
        HL_SHANGHAI,
      );
      expect(points(container)).toHaveLength(0);
      unmount();
    }
  });

  it("表格 / 数值卡不产生图元", () => {
    const table = renderWidget(makeWidget({ id: "wTable", type: "table" }), HL_SHANGHAI);
    expect(points(table.container)).toHaveLength(0);

    const kpi = renderWidget(makeWidget({ id: "wKpi", type: "kpi" }), HL_SHANGHAI);
    expect(points(kpi.container)).toHaveLength(0);
  });
});

describe("透明度常量", () => {
  it("变暗透明度为 0.25（与 UAT.md 一致）", () => {
    expect(DIM_OPACITY).toBe(0.25);
  });
});
