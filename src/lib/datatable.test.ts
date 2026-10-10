import { describe, expect, it } from "vitest";
import { filterRows, paginate, sortRows } from "./datatable";

describe("sortRows", () => {
  const rows = [
    ["b", 2],
    ["a", 3],
    ["c", 1],
  ];

  it("按字符串列升序", () => {
    expect(sortRows(rows, { columnIndex: 0, direction: "asc" })).toEqual([
      ["a", 3],
      ["b", 2],
      ["c", 1],
    ]);
  });

  it("按数值列降序", () => {
    expect(sortRows(rows, { columnIndex: 1, direction: "desc" })).toEqual([
      ["a", 3],
      ["b", 2],
      ["c", 1],
    ]);
  });

  it("空值排在末尾（升序）", () => {
    const data = [["x", 2], ["y", null], ["z", 1]];
    expect(sortRows(data, { columnIndex: 1, direction: "asc" })).toEqual([
      ["z", 1],
      ["x", 2],
      ["y", null],
    ]);
  });

  it("sort 为 null 时原样返回", () => {
    expect(sortRows(rows, null)).toBe(rows);
  });

  it("不修改入参数组", () => {
    const original = [...rows];
    sortRows(rows, { columnIndex: 0, direction: "desc" });
    expect(rows).toEqual(original);
  });
});

describe("filterRows", () => {
  const rows = [
    ["Alice", 30],
    ["bob", 25],
    [null, 40],
  ];

  it("命中任一列即保留（不区分大小写）", () => {
    expect(filterRows(rows, "alice")).toEqual([["Alice", 30]]);
  });

  it("数值列可命中", () => {
    expect(filterRows(rows, "25")).toEqual([["bob", 25]]);
  });

  it("空关键字原样返回", () => {
    expect(filterRows(rows, "  ")).toBe(rows);
  });
});

describe("paginate", () => {
  const rows = Array.from({ length: 25 }, (_, i) => i);

  it("切分页码并返回起始行号", () => {
    const r = paginate(rows, 2, 10);
    expect(r.pageCount).toBe(3);
    expect(r.page).toBe(2);
    expect(r.startIndex).toBe(11);
    expect(r.pageRows).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  });

  it("页码越界时夹紧", () => {
    expect(paginate(rows, 99, 10).page).toBe(3);
    expect(paginate(rows, 0, 10).page).toBe(1);
  });

  it("空集合返回单页", () => {
    const r = paginate([], 1, 10);
    expect(r.pageCount).toBe(1);
    expect(r.startIndex).toBe(0);
    expect(r.pageRows).toEqual([]);
  });
});
