// UAT 逻辑层脚本：交叉高亮的透明度和选中状态推导。
// 覆盖 UAT-HL-01/02/04/05/06/07/08/09/10/15/16（不依赖 DOM，验证核心规则）。
import { describe, expect, it } from "vitest";
import {
  DIM_OPACITY,
  cellOpacity,
  toggleSelection,
  type HighlightSelection,
} from "@/lib/highlight";
import { aggregate } from "@/lib/aggregate";
import { cityEncoding, regionEncoding, salesDataset } from "./fixtures";

const ds = salesDataset();

/** 由聚合结果取得某图表按维度分组的分类值（标签） */
function categories(enc: ReturnType<typeof cityEncoding>): string[] {
  const agg = aggregate(ds, enc);
  return agg.data.map((row) => String(row[agg.dimensionKey]));
}

const CITIES = categories(cityEncoding()); // [上海, 北京, 广州, 深圳]
const REGIONS = categories(regionEncoding()); // [华东, 华北, 华南]

/** 某图表在当前高亮下的各分类透明度 */
function opacities(
  selection: HighlightSelection | null,
  field: string,
  values: string[],
): Record<string, number> {
  return Object.fromEntries(
    values.map((v) => [v, cellOpacity(selection, field, v)]),
  );
}

/** 依据 sales.csv 校验基准分类集合（确保脚本与 UAT.md 测试数据一致） */
describe("基准数据（sales.csv）", () => {
  it("城市分组为 上海/北京/广州/深圳，地区分组为 华东/华北/华南", () => {
    expect(CITIES).toEqual(["上海", "北京", "广州", "深圳"]);
    expect(REGIONS).toEqual(["华东", "华北", "华南"]);
  });

  it("城市 sum(销售额) 聚合值符合 UAT.md 预期", () => {
    const agg = aggregate(ds, cityEncoding());
    const byCity = Object.fromEntries(
      agg.data.map((r) => [r["城市"], r["sum(销售额)"]]),
    );
    expect(byCity).toEqual({ 上海: 250, 北京: 178, 广州: 156, 深圳: 195 });
  });
});

describe("UAT-HL-01 单选触发跨图表高亮", () => {
  it("命中所选值的城市保持不透明，其余城市变暗", () => {
    const sel = toggleSelection(null, "城市", "上海", "wA", false)!;
    expect(opacities(sel, "城市", CITIES)).toEqual({
      上海: 1,
      北京: DIM_OPACITY,
      广州: DIM_OPACITY,
      深圳: DIM_OPACITY,
    });
    // 图表 B（同为「城市」分组）与图表 A 表现一致
    expect(cellOpacity(sel, "城市", "上海")).toBe(1);
    expect(cellOpacity(sel, "城市", "广州")).toBe(DIM_OPACITY);
    // 图表 C（「地区」分组）完全不变
    expect(opacities(sel, "地区", REGIONS)).toEqual({
      华东: 1,
      华北: 1,
      华南: 1,
    });
  });
});

describe("UAT-HL-02 来源图表自身也变暗", () => {
  it("来源视觉对象不豁免：其未选中项同样变暗", () => {
    const sel = toggleSelection(null, "城市", "上海", "wA", false)!;
    // 来源即 wA，其非选中城市仍为变暗
    expect(sel.sourceId).toBe("wA");
    expect(cellOpacity(sel, "城市", "深圳")).toBe(DIM_OPACITY);
  });
});

describe("UAT-HL-04 再次点击同一元素清除高亮", () => {
  it("同源同值再次点击返回 null，全部恢复不透明", () => {
    const sel = toggleSelection(null, "城市", "上海", "wA", false)!;
    const cleared = toggleSelection(sel, "城市", "上海", "wA", false);
    expect(cleared).toBeNull();
    expect(opacities(cleared, "城市", CITIES)).toEqual({
      上海: 1,
      北京: 1,
      广州: 1,
      深圳: 1,
    });
  });
});

describe("UAT-HL-05 ⌘/Ctrl 累加多选", () => {
  it("⌘ 点击累加值，选中集包含两个值", () => {
    const first = toggleSelection(null, "城市", "上海", "wA", false)!;
    const second = toggleSelection(first, "城市", "北京", "wA", true)!;
    expect(second.values).toEqual(["上海", "北京"]);
    expect(opacities(second, "城市", CITIES)).toEqual({
      上海: 1,
      北京: 1,
      广州: DIM_OPACITY,
      深圳: DIM_OPACITY,
    });
  });
});

describe("UAT-HL-06 ⌘ 点击已选值将其移除", () => {
  it("⌘ 再点「北京」后收敛为单值「上海」", () => {
    const multi: HighlightSelection = {
      field: "城市",
      values: ["上海", "北京"],
      sourceId: "wA",
    };
    const next = toggleSelection(multi, "城市", "北京", "wA", true)!;
    expect(next.values).toEqual(["上海"]);
    expect(opacities(next, "城市", CITIES)).toEqual({
      上海: 1,
      北京: DIM_OPACITY,
      广州: DIM_OPACITY,
      深圳: DIM_OPACITY,
    });
  });
});

describe("UAT-HL-07 ⌘ 移除最后一个值后清除高亮", () => {
  it("移除唯一选中值后进入空选中集并清除高亮", () => {
    const sel = toggleSelection(null, "城市", "上海", "wA", false)!;
    const cleared = toggleSelection(sel, "城市", "上海", "wA", true);
    expect(cleared).toBeNull();
  });
});

describe("UAT-HL-08 同源换值替换选中", () => {
  it("不按 ⌘ 直接点击其它值则替换而非累加", () => {
    const sel = toggleSelection(null, "城市", "上海", "wA", false)!;
    const next = toggleSelection(sel, "城市", "广州", "wA", false)!;
    expect(next.values).toEqual(["广州"]);
    expect(opacities(next, "城市", CITIES)).toEqual({
      上海: DIM_OPACITY,
      北京: DIM_OPACITY,
      广州: 1,
      深圳: DIM_OPACITY,
    });
  });
});

describe("UAT-HL-09 换来源替换字段与来源", () => {
  it("从城市图切到地区图：字段/来源/值全部替换，城市图恢复不透明", () => {
    const city = toggleSelection(null, "城市", "上海", "wA", false)!;
    const region = toggleSelection(city, "地区", "华南", "wC", false)!;
    expect(region).toEqual({
      field: "地区",
      values: ["华南"],
      sourceId: "wC",
    });
    // 图表 C 内「华南」不透明，其余地区变暗
    expect(opacities(region, "地区", REGIONS)).toEqual({
      华东: DIM_OPACITY,
      华北: DIM_OPACITY,
      华南: 1,
    });
    // 图表 A、B（城市分组）恢复全部不透明
    expect(opacities(region, "城市", CITIES)).toEqual({
      上海: 1,
      北京: 1,
      广州: 1,
      深圳: 1,
    });
  });
});

describe("UAT-HL-10 从另一图表点击同字段替换来源", () => {
  it("同字段但不同来源：来源替换为目标图表，值为目标值", () => {
    const a = toggleSelection(null, "城市", "上海", "wA", false)!;
    const b = toggleSelection(a, "城市", "北京", "wB", false)!;
    expect(b).toEqual({ field: "城市", values: ["北京"], sourceId: "wB" });
    expect(opacities(b, "城市", CITIES)).toEqual({
      上海: DIM_OPACITY,
      北京: 1,
      广州: DIM_OPACITY,
      深圳: DIM_OPACITY,
    });
  });
});

describe("UAT-HL-15 字段不匹配的图表不响应", () => {
  it("城市高亮对「地区」分组图表无任何影响", () => {
    const sel = toggleSelection(null, "城市", "上海", "wA", false)!;
    expect(cellOpacity(sel, "地区", "华东")).toBe(1);
    expect(cellOpacity(sel, "地区", "华南")).toBe(1);
  });
});

describe("UAT-HL-16 无维度分组的图表点击不影响其它", () => {
  it("无维度图表选中 `__all__` 时，按具体字段分组的图表不变暗", () => {
    const agg = aggregate(ds, { measures: [{ field: "销售额", agg: "sum" }] });
    expect(agg.dimensionKey).toBe("__all__");
    const sel = toggleSelection(null, "__all__", "__all__", "wKpi", false)!;
    expect(sel.field).toBe("__all__");
    expect(opacities(sel, "城市", CITIES)).toEqual({
      上海: 1,
      北京: 1,
      广州: 1,
      深圳: 1,
    });
  });
});
