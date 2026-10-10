// UAT 组件层脚本：填充地图的交叉高亮表现。
// 覆盖 UAT-HL-25（有数据区域变暗、无数据区域保持原样、点击用数据标签、未匹配不可点击）。
//
// 说明：MapChart 懒加载内置 GeoJSON（@/lib/geo），此处仅打桩异步加载器
// loadGeo / resolveScope，返回固定的 5 要素假数据，其余纯函数（normalizeRegion、
// buildRegionIndex、matchRegion、投影、色阶）保留真实实现，以便确定性校验。
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { GeoFeatureCollection } from "@/lib/geo";
import { DIM_OPACITY, type HighlightSelection } from "@/lib/highlight";
import { aggregate } from "@/lib/aggregate";
import { salesDataset } from "./fixtures";

// 5 个要素：上海/北京/广州/深圳 有数据，天津 无数据
const { FIXTURE_FC } = vi.hoisted(() => {
  function square(name: string, lon: number, lat: number) {
    const d = 0.6;
    const ring: [number, number][] = [
      [lon - d, lat - d],
      [lon + d, lat - d],
      [lon + d, lat + d],
      [lon - d, lat + d],
      [lon - d, lat - d],
    ];
    return {
      type: "Feature" as const,
      properties: { name },
      geometry: { type: "Polygon" as const, coordinates: [ring] },
    };
  }
  const fc: GeoFeatureCollection = {
    type: "FeatureCollection",
    features: [
      square("上海", 121, 31),
      square("北京", 116, 39),
      square("广州", 113, 23),
      square("深圳", 114, 22),
      square("天津", 117, 39),
    ],
  };
  return { FIXTURE_FC: fc };
});

vi.mock("@/lib/geo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/geo")>();
  return {
    ...actual,
    loadGeo: async () => FIXTURE_FC,
    resolveScope: async () => "china" as const,
  };
});

import { MapChart } from "@/features/dashboard/MapChart";

const ds = salesDataset();
const agg = aggregate(ds, {
  dimension: "城市",
  measures: [{ field: "销售额", agg: "sum" }],
});
const VALUE_KEY = "sum(销售额)"; // agg.measureKeys[0]

const HL_SHANGHAI: HighlightSelection = {
  field: "城市",
  values: ["上海"],
  sourceId: "wA",
};

function renderMap(
  highlight: HighlightSelection | null,
  onPointClick?: (field: string, value: string, additive: boolean) => void,
) {
  return render(
    <MapChart
      rows={agg.data}
      dimensionKey={agg.dimensionKey}
      valueKey={VALUE_KEY}
      highlight={highlight}
      onPointClick={onPointClick}
    />,
  );
}

/** 等待地图边界加载并渲染出全部区域 path（要素顺序：上海/北京/广州/深圳/天津） */
async function mapPaths(container: HTMLElement): Promise<SVGPathElement[]> {
  await waitFor(() =>
    expect(container.querySelectorAll("svg path")).toHaveLength(5),
  );
  return Array.from(container.querySelectorAll<SVGPathElement>("svg path"));
}

function opacities(paths: SVGPathElement[]): (string | null)[] {
  return paths.map((p) => p.getAttribute("fill-opacity"));
}

afterEach(() => cleanup());

describe("UAT-HL-25 地图区域", () => {
  it("有数据区域按高亮变暗，无数据区域保持不透明", async () => {
    const { container } = renderMap(HL_SHANGHAI);
    const paths = await mapPaths(container);
    // 上海命中 → 1；北京/广州/深圳 有数据未命中 → 0.25；天津 无数据 → 1
    expect(opacities(paths)).toEqual([
      "1",
      String(DIM_OPACITY),
      String(DIM_OPACITY),
      String(DIM_OPACITY),
      "1",
    ]);
  });

  it("点击有数据区域回传数据标签与 additive；未匹配区域不可点击", async () => {
    const onPointClick = vi.fn();
    const { container } = renderMap(HL_SHANGHAI, onPointClick);
    const paths = await mapPaths(container);

    // 有数据区域可点击（光标为 pointer）
    expect(paths[0]).toHaveClass("cursor-pointer");
    fireEvent.click(paths[0]);
    expect(onPointClick).toHaveBeenLastCalledWith("城市", "上海", false);

    // ⌘ 点击其它有数据区域 → additive
    fireEvent.click(paths[2], { metaKey: true });
    expect(onPointClick).toHaveBeenLastCalledWith("城市", "广州", true);

    // 无数据区域（天津）不可点击、光标默认，点击不触发
    expect(paths[4]).toHaveClass("cursor-default");
    fireEvent.click(paths[4]);
    expect(onPointClick).toHaveBeenCalledTimes(2);
  });
});
