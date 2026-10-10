// UAT 组件层脚本：数据透视表（矩阵）的交叉高亮表现。
// 覆盖 UAT-HL-03（高亮不改变聚合与总计）、UAT-HL-26（数据行高亮、总计行不可点击）。
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { aggregate } from "@/lib/aggregate";
import { DIM_OPACITY, type HighlightSelection } from "@/lib/highlight";
import { PivotTable } from "@/features/dashboard/PivotTable";
import { salesDataset } from "./fixtures";

const ds = salesDataset();
const agg = aggregate(ds, {
  dimension: "城市",
  measures: [
    { field: "销售额", agg: "sum" },
    { field: "利润", agg: "sum" },
  ],
});
const columnKeys = agg.measureKeys; // ["sum(销售额)", "sum(利润)"]

const HL_SHANGHAI: HighlightSelection = {
  field: "城市",
  values: ["上海"],
  sourceId: "wA",
};

function renderPivot(
  highlight: HighlightSelection | null,
  onPointClick?: (field: string, value: string, additive: boolean) => void,
) {
  return render(
    <PivotTable
      rows={agg.data}
      dimensionKey={agg.dimensionKey}
      columnKeys={columnKeys}
      highlight={highlight}
      onPointClick={onPointClick}
    />,
  );
}

/** 数据行（tbody 下的 tr），按维度标签索引 */
function dataRows(container: HTMLElement): Map<string, HTMLTableRowElement> {
  const map = new Map<string, HTMLTableRowElement>();
  container.querySelectorAll<HTMLTableRowElement>("tbody tr").forEach((tr) => {
    const label = tr.querySelector("th")?.textContent ?? "";
    map.set(label, tr);
  });
  return map;
}

afterEach(() => cleanup());

describe("UAT-HL-03 高亮不改变聚合与总计", () => {
  it("选中城市行保持不透明，其余行变暗", () => {
    const { container } = renderPivot(HL_SHANGHAI);
    const rows = dataRows(container);
    expect(rows.get("上海")!.style.opacity).toBe("1");
    expect(rows.get("北京")!.style.opacity).toBe(String(DIM_OPACITY));
    expect(rows.get("广州")!.style.opacity).toBe(String(DIM_OPACITY));
    expect(rows.get("深圳")!.style.opacity).toBe(String(DIM_OPACITY));
  });

  it("各行数值、行总计、列总计、总计均与点击前一致（不做行过滤）", () => {
    const before = renderPivot(null);
    const beforeText = before.container.querySelector("table")!.textContent;
    before.unmount();

    const after = renderPivot(HL_SHANGHAI);
    const afterText = after.container.querySelector("table")!.textContent;
    expect(afterText).toBe(beforeText);

    // 与 sales.csv 的期望值对齐：上海行 250 / 63 / 313；右下角总计 967
    const rows = dataRows(after.container);
    const shanghai = Array.from(rows.get("上海")!.querySelectorAll("td")).map(
      (td) => td.textContent,
    );
    expect(shanghai).toEqual(["250", "63", "313"]);
    expect(after.container.querySelector("tfoot")!.textContent).toContain("967");
  });
});

describe("UAT-HL-26 数据透视表行", () => {
  it("点击数据行触发高亮，总计行不可点击/不参与高亮", () => {
    const onPointClick = vi.fn();
    const { container } = renderPivot(HL_SHANGHAI, onPointClick);
    const rows = dataRows(container);

    expect(rows.get("上海")!).toHaveClass("cursor-pointer");
    fireEvent.click(rows.get("上海")!);
    expect(onPointClick).toHaveBeenLastCalledWith("城市", "上海", false);

    // ⌘ 多选
    fireEvent.click(rows.get("北京")!, { metaKey: true });
    expect(onPointClick).toHaveBeenLastCalledWith("城市", "北京", true);

    // 总计行（tfoot）不可点击、无高亮透明度
    const footRow = container.querySelector<HTMLTableRowElement>("tfoot tr")!;
    expect(footRow).not.toHaveClass("cursor-pointer");
    expect(footRow.style.opacity).toBe("");
    fireEvent.click(footRow);
    expect(onPointClick).toHaveBeenCalledTimes(2);
  });
});
