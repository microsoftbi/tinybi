import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";

describe("parseCsv", () => {
  it("解析表头与数据行并推断类型", () => {
    const text = "name,age,active\nAlice,30,true\nBob,25,false";
    const ds = parseCsv(text, "people.csv");

    expect(ds.name).toBe("people.csv");
    expect(ds.source).toBe("csv");
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
    const ds = parseCsv("a,a\n1,2", "dup.csv");
    expect(ds.columns.map((c) => c.name)).toEqual(["a", "a_1"]);
  });

  it("空文件抛出错误", () => {
    expect(() => parseCsv("", "empty.csv")).toThrow();
  });

  it("忽略尾部空行", () => {
    const ds = parseCsv("a\n1\n\n\n", "trailing.csv");
    expect(ds.rows).toHaveLength(1);
  });
});
