import { describe, expect, it } from "vitest";
import {
  buildColumns,
  coerceCell,
  coerceRows,
  dedupeHeaders,
  inferColumnType,
} from "./columns";

describe("inferColumnType", () => {
  it("将布尔列推断为 boolean", () => {
    expect(inferColumnType(["true", "false", "TRUE"])).toBe("boolean");
  });

  it("将数值列推断为 number", () => {
    expect(inferColumnType([1, "2", 3.5])).toBe("number");
  });

  it("将日期列推断为 date", () => {
    expect(inferColumnType(["2024-01-01", "2024-06-15"])).toBe("date");
  });

  it("将混合文本推断为 string", () => {
    expect(inferColumnType(["a", "b", "c"])).toBe("string");
  });

  it("忽略空值参与推断", () => {
    expect(inferColumnType([null, "", "1", "2"])).toBe("number");
  });

  it("全为空时回退为 string", () => {
    expect(inferColumnType([null, "", null])).toBe("string");
  });
});

describe("coerceCell", () => {
  it("空值统一为 null", () => {
    expect(coerceCell("", "number")).toBeNull();
    expect(coerceCell(null, "string")).toBeNull();
    expect(coerceCell(null, "boolean")).toBeNull();
  });

  it("按类型转换数值与布尔", () => {
    expect(coerceCell("42", "number")).toBe(42);
    expect(coerceCell("not-a-number", "number")).toBeNull();
    expect(coerceCell("TRUE", "boolean")).toBe(true);
    expect(coerceCell("false", "boolean")).toBe(false);
  });

  it("日期转换为 ISO 字符串", () => {
    const iso = coerceCell("2024-01-01", "date");
    expect(typeof iso).toBe("string");
    expect(new Date(iso as string).getUTCFullYear()).toBe(2024);
  });

  it("无法解析的日期保留原字符串", () => {
    expect(coerceCell("n/a", "date")).toBe("n/a");
  });
});

describe("dedupeHeaders", () => {
  it("重名列追加序号后缀", () => {
    expect(dedupeHeaders(["a", "b", "a", "a"])).toEqual([
      "a",
      "b",
      "a_1",
      "a_2",
    ]);
  });

  it("空表头回退为列序号", () => {
    expect(dedupeHeaders(["", "  ", "c"])).toEqual(["列1", "列2", "c"]);
  });
});

describe("buildColumns + coerceRows", () => {
  it("构建列元数据并转换行数据", () => {
    const rows = [
      ["1", "true", "2024-01-01"],
      ["2", "false", "2024-02-01"],
    ];
    const columns = buildColumns(["n", "b", "d"], rows);
    expect(columns.map((c) => c.type)).toEqual(["number", "boolean", "date"]);

    const coerced = coerceRows(rows, columns);
    expect(coerced[0][0]).toBe(1);
    expect(coerced[1][1]).toBe(false);
  });
});
