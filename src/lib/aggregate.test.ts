import { describe, expect, it } from "vitest";
import type { Dataset } from "@/types";
import { aggregate, applyAgg, measureKey } from "./aggregate";

describe("applyAgg", () => {
  it("sum 忽略空值", () => {
    expect(applyAgg([1, 2, null, "", 3], "sum")).toBe(6);
  });

  it("count 统计全部行数", () => {
    expect(applyAgg([1, null, 3], "count")).toBe(3);
  });

  it("avg/min/max 计算正确", () => {
    expect(applyAgg([2, 4, 6], "avg")).toBe(4);
    expect(applyAgg([2, 4, 6], "min")).toBe(2);
    expect(applyAgg([2, 4, 6], "max")).toBe(6);
  });

  it("none 取第一个有效值", () => {
    expect(applyAgg([null, 5, 9], "none")).toBe(5);
  });

  it("空数组时 sum 为 0，其余为 null", () => {
    expect(applyAgg([], "sum")).toBe(0);
    expect(applyAgg([], "avg")).toBeNull();
    expect(applyAgg([], "count")).toBe(0);
  });
});

describe("measureKey", () => {
  it("由聚合函数与字段名组成", () => {
    expect(measureKey({ field: "sales", agg: "sum" })).toBe("sum(sales)");
  });
});

const dataset: Dataset = {
  id: "ds1",
  name: "test",
  source: "csv",
  createdAt: "2024-01-01T00:00:00.000Z",
  columns: [
    { name: "region", type: "string" },
    { name: "product", type: "string" },
    { name: "sales", type: "number" },
  ],
  rows: [
    ["East", "A", 10],
    ["East", "B", 20],
    ["West", "A", 5],
    ["West", "B", 15],
  ],
};

describe("aggregate", () => {
  it("按维度分组并应用度量", () => {
    const result = aggregate(dataset, {
      dimension: "region",
      measures: [{ field: "sales", agg: "sum" }],
    });

    expect(result.dimensionKey).toBe("region");
    expect(result.measureKeys).toEqual(["sum(sales)"]);
    expect(result.series).toEqual([]);
    expect(result.data).toEqual([
      { region: "East", "sum(sales)": 30 },
      { region: "West", "sum(sales)": 20 },
    ]);
  });

  it("多度量同时输出", () => {
    const result = aggregate(dataset, {
      dimension: "region",
      measures: [
        { field: "sales", agg: "sum" },
        { field: "sales", agg: "count" },
      ],
    });
    expect(result.data[0]).toEqual({
      region: "East",
      "sum(sales)": 30,
      "count(sales)": 2,
    });
  });

  it("单度量 + 系列分组时透视", () => {
    const result = aggregate(dataset, {
      dimension: "region",
      series: "product",
      measures: [{ field: "sales", agg: "sum" }],
    });

    expect(result.series).toEqual(["A", "B"]);
    expect(result.data).toEqual([
      { region: "East", A: 10, B: 20 },
      { region: "West", A: 5, B: 15 },
    ]);
  });

  it("无维度时聚合到 __all__", () => {
    const result = aggregate(dataset, {
      measures: [{ field: "sales", agg: "sum" }],
    });
    expect(result.dimensionKey).toBe("__all__");
    expect(result.data).toEqual([{ __all__: "__all__", "sum(sales)": 50 }]);
  });
});
