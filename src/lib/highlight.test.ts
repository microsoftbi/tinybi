import { describe, expect, it } from "vitest";
import {
  cellOpacity,
  toggleSelection,
  type HighlightSelection,
} from "./highlight";

describe("cellOpacity", () => {
  const sel: HighlightSelection = {
    field: "城市",
    values: ["上海", "北京"],
    sourceId: "w1",
  };

  it("无选中时返回 1", () => {
    expect(cellOpacity(null, "城市", "上海")).toBe(1);
  });

  it("字段未定义时返回 1", () => {
    expect(cellOpacity(sel, undefined, "上海")).toBe(1);
  });

  it("图表分组字段与选中字段不一致时返回 1", () => {
    expect(cellOpacity(sel, "地区", "华东")).toBe(1);
  });

  it("命中选中值返回 1", () => {
    expect(cellOpacity(sel, "城市", "上海")).toBe(1);
  });

  it("未命中选中值返回变暗透明度", () => {
    expect(cellOpacity(sel, "城市", "广州")).toBe(0.25);
  });

  it("支持自定义变暗透明度", () => {
    expect(cellOpacity(sel, "城市", "广州", 0.1)).toBe(0.1);
  });
});

describe("toggleSelection", () => {
  it("从空选中点击后选中该值", () => {
    const next = toggleSelection(null, "城市", "上海", "w1", false);
    expect(next).toEqual({ field: "城市", values: ["上海"], sourceId: "w1" });
  });

  it("再次点击同源唯一选中项则清除", () => {
    const prev: HighlightSelection = {
      field: "城市",
      values: ["上海"],
      sourceId: "w1",
    };
    expect(toggleSelection(prev, "城市", "上海", "w1", false)).toBeNull();
  });

  it("同源点击不同值则替换选中", () => {
    const prev: HighlightSelection = {
      field: "城市",
      values: ["上海"],
      sourceId: "w1",
    };
    expect(toggleSelection(prev, "城市", "北京", "w1", false)).toEqual({
      field: "城市",
      values: ["北京"],
      sourceId: "w1",
    });
  });

  it("不同来源点击则替换选中", () => {
    const prev: HighlightSelection = {
      field: "城市",
      values: ["上海"],
      sourceId: "w1",
    };
    expect(toggleSelection(prev, "地区", "华东", "w2", false)).toEqual({
      field: "地区",
      values: ["华东"],
      sourceId: "w2",
    });
  });

  it("按 ⌘ 累加同源多选", () => {
    const prev: HighlightSelection = {
      field: "城市",
      values: ["上海"],
      sourceId: "w1",
    };
    expect(toggleSelection(prev, "城市", "北京", "w1", true)).toEqual({
      field: "城市",
      values: ["上海", "北京"],
      sourceId: "w1",
    });
  });

  it("按 ⌘ 移除已选值，若清空则返回 null", () => {
    const prev: HighlightSelection = {
      field: "城市",
      values: ["上海"],
      sourceId: "w1",
    };
    expect(toggleSelection(prev, "城市", "上海", "w1", true)).toBeNull();
  });

  it("按 ⌘ 但来源不同则替换而非累加", () => {
    const prev: HighlightSelection = {
      field: "城市",
      values: ["上海"],
      sourceId: "w1",
    };
    expect(toggleSelection(prev, "地区", "华东", "w2", true)).toEqual({
      field: "地区",
      values: ["华东"],
      sourceId: "w2",
    });
  });
});
