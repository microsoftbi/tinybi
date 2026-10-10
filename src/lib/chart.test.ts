import { describe, expect, it } from "vitest";
import { normalizeToPercent } from "./chart";

describe("normalizeToPercent", () => {
  it("按行内合计归一化为百分比，并保留维度字段", () => {
    const data = [
      { 地区: "华东", A: 30, B: 10 },
      { 地区: "华北", A: 50, B: 50 },
    ];
    const result = normalizeToPercent(data, ["A", "B"]);

    expect(result[0]).toMatchObject({ 地区: "华东", A: 75, B: 25 });
    expect(result[1]).toMatchObject({ 地区: "华北", A: 50, B: 50 });
  });

  it("行内合计为 0 时全部记为 0，避免除零", () => {
    const result = normalizeToPercent([{ 地区: "华南", A: 0, B: 0 }], ["A", "B"]);
    expect(result[0]).toMatchObject({ A: 0, B: 0 });
  });

  it("非数值或缺失值按 0 处理", () => {
    const result = normalizeToPercent(
      [
        { 地区: "西南", A: null, B: "10" },
        { 地区: "西北", A: 3, B: "7" },
      ],
      ["A", "B"],
    );
    // 首行全为非数值 → 合计 0，全部记 0
    expect(result[0]).toMatchObject({ A: 0, B: 0 });
    // 次行仅 A 为数值 → A 占 100%
    expect(result[1]).toMatchObject({ A: 100, B: 0 });
  });

  it("不修改原始输入对象", () => {
    const row = { 地区: "东北", A: 1, B: 3 };
    normalizeToPercent([row], ["A", "B"]);
    expect(row).toEqual({ 地区: "东北", A: 1, B: 3 });
  });
});
