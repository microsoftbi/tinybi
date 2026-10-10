import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseExcel } from "./xlsx";

type Cell = string | number | boolean | null;

/** 用 sheetjs 在内存中生成一个单工作表的 xlsx 二进制 */
function makeXlsx(aoa: Cell[][]): Uint8Array {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new Uint8Array(out);
}

describe("parseExcel", () => {
  it("解析工作表并推断类型", () => {
    const bytes = makeXlsx([
      ["name", "age", "active"],
      ["Alice", 30, true],
      ["Bob", 25, false],
    ]);
    const ds = parseExcel(bytes, "people.xlsx");

    expect(ds.name).toBe("people.xlsx");
    expect(ds.source).toBe("excel");
    expect(ds.columns.map((c) => c.name)).toEqual(["name", "age", "active"]);
    expect(ds.columns.map((c) => c.type)).toEqual([
      "string",
      "number",
      "boolean",
    ]);
    expect(ds.rows).toHaveLength(2);
    expect(ds.rows[0]).toEqual(["Alice", 30, true]);
  });

  it("去重重复表头", () => {
    const bytes = makeXlsx([
      ["a", "a"],
      [1, 2],
    ]);
    const ds = parseExcel(bytes, "dup.xlsx");
    expect(ds.columns.map((c) => c.name)).toEqual(["a", "a_1"]);
  });

  it("仅表头时返回空行集", () => {
    const bytes = makeXlsx([["a", "b"]]);
    const ds = parseExcel(bytes, "header.xlsx");
    expect(ds.columns.map((c) => c.name)).toEqual(["a", "b"]);
    expect(ds.rows).toHaveLength(0);
  });

  it("空单元格归一化为 null", () => {
    const bytes = makeXlsx([
      ["a", "b", "c"],
      [1, null, 3],
    ]);
    const ds = parseExcel(bytes, "nulls.xlsx");
    expect(ds.rows[0]).toEqual([1, null, 3]);
  });
});
