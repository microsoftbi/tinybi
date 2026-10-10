import { describe, expect, it } from "vitest";
import { buildPivot } from "./pivot";

describe("buildPivot", () => {
  it("生成交叉表并计算行列总计", () => {
    const rows = [
      { 地区: "华东", 线上: 10, 线下: 20 },
      { 地区: "华南", 线上: 5, 线下: 7 },
    ];
    const result = buildPivot(rows, "地区", ["线上", "线下"]);

    expect(result.columns).toEqual(["线上", "线下"]);
    expect(result.rows).toEqual([
      { label: "华东", cells: [10, 20], total: 30 },
      { label: "华南", cells: [5, 7], total: 12 },
    ]);
    expect(result.colTotals).toEqual([15, 27]);
    expect(result.grandTotal).toBe(42);
  });

  it("空值单元格保留为 null，但合计按 0 计算", () => {
    const rows = [
      { 地区: "华东", 线上: 10, 线下: null },
      { 地区: "华南", 线上: null, 线下: 6 },
    ];
    const result = buildPivot(rows, "地区", ["线上", "线下"]);

    expect(result.rows[0].cells).toEqual([10, null]);
    expect(result.rows[0].total).toBe(10);
    expect(result.rows[1].cells).toEqual([null, 6]);
    expect(result.colTotals).toEqual([10, 6]);
    expect(result.grandTotal).toBe(16);
  });

  it("非数值单元格按 null 处理，不计入合计", () => {
    const rows = [{ 地区: "华东", 线上: "ab", 线下: 8 }];
    const result = buildPivot(rows, "地区", ["线上", "线下"]);

    expect(result.rows[0].cells).toEqual([null, 8]);
    expect(result.rows[0].total).toBe(8);
    expect(result.colTotals).toEqual([0, 8]);
    expect(result.grandTotal).toBe(8);
  });

  it("空维度值以「(空)」作为行标签", () => {
    const rows = [{ 地区: "", 值: 1 }];
    const result = buildPivot(rows, "地区", ["值"]);
    expect(result.rows[0].label).toBe("(空)");
  });

  it("无列字段时返回空列与零合计", () => {
    const rows = [{ 地区: "华东" }];
    const result = buildPivot(rows, "地区", []);

    expect(result.columns).toEqual([]);
    expect(result.rows).toEqual([{ label: "华东", cells: [], total: 0 }]);
    expect(result.colTotals).toEqual([]);
    expect(result.grandTotal).toBe(0);
  });

  it("无数据时返回空结果", () => {
    const result = buildPivot([], "地区", ["值"]);
    expect(result.rows).toEqual([]);
    expect(result.colTotals).toEqual([0]);
    expect(result.grandTotal).toBe(0);
  });
});
