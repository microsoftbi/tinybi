// UAT 外壳层脚本：仪表盘容器对交叉高亮生命周期的管理。
// 覆盖 UAT-HL-11（点击空白清除）、UAT-HL-12（Esc 清除）、UAT-HL-13（切换仪表盘清除）、
// UAT-HL-14（删除来源图表清除）、UAT-HL-28（高亮不写入项目文件）。
//
// 说明：DashboardView 内部通过 ReportCanvas 传递 highlight。此处将 ReportCanvas 替换为
// 可编程替身（暴露当前 highlight 与触发点），从而在不依赖真实图表渲染的情况下，
// 精确校验外壳的状态清除逻辑。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { HighlightSelection } from "@/lib/highlight";

vi.mock("@/features/dashboard/ReportCanvas", async () => {
  const React = await import("react");
  interface CanvasProps {
    widgets: Array<{ id: string }>;
    highlight?: HighlightSelection | null;
    onPointClick?: (
      sourceId: string,
      field: string,
      value: string,
      additive: boolean,
    ) => void;
    onRemove: (id: string) => void;
  }
  /** 替身：data-highlight 输出当前高亮；提供点击/删除触发点 */
  function ReportCanvas(props: CanvasProps) {
    const hl = props.highlight;
    return React.createElement(
      "div",
      {
        "data-testid": "canvas",
        "data-highlight": hl
          ? `${hl.sourceId}:${hl.field}:${hl.values.join(",")}`
          : "none",
      },
      React.createElement(
        "button",
        {
          "data-testid": "click-shanghai",
          onClick: () => props.onPointClick?.("w1", "城市", "上海", false),
        },
        "click-shanghai",
      ),
      props.widgets.map((w) =>
        React.createElement(
          "button",
          {
            key: w.id,
            "data-testid": `del-${w.id}`,
            onClick: () => props.onRemove(w.id),
          },
          `del-${w.id}`,
        ),
      ),
    );
  }
  return { ReportCanvas };
});

vi.mock("@/features/dashboard/FieldsPane", () => ({ FieldsPane: () => null }));
vi.mock("@/features/dashboard/VisualizationsPane", () => ({
  VisualizationsPane: () => null,
}));
vi.mock("sonner", () => ({ toast: { success: () => {}, error: () => {} } }));

import { DashboardView } from "@/features/dashboard/DashboardView";
import { useDashboardStore } from "@/stores/dashboardStore";
import { useDatasetStore } from "@/stores/datasetStore";
import { makeWidget, salesDataset } from "./fixtures";

beforeEach(() => {
  useDatasetStore.setState({ datasets: [salesDataset()] });
  useDashboardStore.setState({
    dashboards: [
      {
        id: "dash1",
        name: "仪表盘 1",
        widgets: [makeWidget({ id: "w1", type: "bar" })],
      },
      { id: "dash2", name: "仪表盘 2", widgets: [] },
    ],
    activeId: "dash1",
  });
});

afterEach(() => cleanup());

/** 读取替身画布当前的高亮描述 */
function highlightOf(el: HTMLElement): string | null {
  return el.getAttribute("data-highlight");
}

describe("UAT-HL-11 点击空白清除", () => {
  it("进入高亮后点击工作区空白处清除高亮", () => {
    const { getByTestId, container } = render(<DashboardView />);
    fireEvent.click(getByTestId("click-shanghai"));
    expect(highlightOf(getByTestId("canvas"))).toBe("w1:城市:上海");

    // 工作区灰色底色空白（bg-muted/40）
    const workspace = container.querySelector<HTMLElement>(
      '[class*="bg-muted/40"]',
    )!;
    expect(workspace).toBeTruthy();
    fireEvent.click(workspace);
    expect(highlightOf(getByTestId("canvas"))).toBe("none");
  });
});

describe("UAT-HL-12 Esc 清除", () => {
  it("按下 Esc 清除高亮", () => {
    const { getByTestId } = render(<DashboardView />);
    fireEvent.click(getByTestId("click-shanghai"));
    expect(highlightOf(getByTestId("canvas"))).toBe("w1:城市:上海");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(highlightOf(getByTestId("canvas"))).toBe("none");
  });
});

describe("UAT-HL-13 切换仪表盘清除", () => {
  it("切换仪表盘清除高亮，切回也不残留", () => {
    const { getByTestId, getByText } = render(<DashboardView />);
    fireEvent.click(getByTestId("click-shanghai"));
    expect(highlightOf(getByTestId("canvas"))).toBe("w1:城市:上海");

    fireEvent.click(getByText("仪表盘 2"));
    expect(highlightOf(getByTestId("canvas"))).toBe("none");

    fireEvent.click(getByText("仪表盘 1"));
    expect(highlightOf(getByTestId("canvas"))).toBe("none");
  });
});

describe("UAT-HL-14 删除来源图表清除", () => {
  it("删除来源视觉对象后清除高亮，且 store 中已移除该图表", () => {
    const { getByTestId } = render(<DashboardView />);
    fireEvent.click(getByTestId("click-shanghai"));
    expect(highlightOf(getByTestId("canvas"))).toBe("w1:城市:上海");

    fireEvent.click(getByTestId("del-w1"));
    expect(highlightOf(getByTestId("canvas"))).toBe("none");

    const widgets = useDashboardStore
      .getState()
      .dashboards.find((d) => d.id === "dash1")!.widgets;
    expect(widgets.find((w) => w.id === "w1")).toBeUndefined();
  });
});

describe("UAT-HL-28 高亮不写入项目文件", () => {
  it("持久化状态不含高亮，重新挂载后无残留", () => {
    const first = render(<DashboardView />);
    fireEvent.click(first.getByTestId("click-shanghai"));
    expect(highlightOf(first.getByTestId("canvas"))).toBe(
      "w1:城市:上海",
    );

    // 模拟 .biproj 持久化内容：仅来自 dashboardStore（高亮为组件内瞬时态）
    const saved = JSON.stringify(useDashboardStore.getState().dashboards);
    expect(saved).not.toMatch(/highlight/i);

    first.unmount();

    // 重新打开项目 → 重新挂载，无高亮残留
    const second = render(<DashboardView />);
    expect(highlightOf(second.getByTestId("canvas"))).toBe("none");
  });
});
