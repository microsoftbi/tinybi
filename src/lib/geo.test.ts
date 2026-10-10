import { describe, expect, it } from "vitest";
import {
  MAP_NO_DATA_COLOR,
  buildRegionIndex,
  createFitProjection,
  detectScope,
  extent,
  featureToPath,
  makeColorScale,
  matchRegion,
  normalizeRegion,
  type GeoFeatureCollection,
} from "./geo";

const chinaFc: GeoFeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "广东省" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [110, 20],
            [114, 20],
            [114, 24],
            [110, 24],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "内蒙古自治区" },
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [100, 40],
              [104, 40],
              [104, 44],
            ],
          ],
        ],
      },
    },
  ],
};

const worldFc: GeoFeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "China" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [73, 18],
            [135, 18],
            [135, 53],
            [73, 53],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "United States of America" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-125, 25],
            [-66, 25],
            [-66, 49],
          ],
        ],
      },
    },
  ],
};

describe("normalizeRegion", () => {
  it("剥离中文行政级别后缀", () => {
    expect(normalizeRegion("广东省")).toBe("广东");
    expect(normalizeRegion("北京市")).toBe("北京");
    expect(normalizeRegion("内蒙古自治区")).toBe("内蒙古");
    expect(normalizeRegion("广西壮族自治区")).toBe("广西");
    expect(normalizeRegion("新疆维吾尔自治区")).toBe("新疆");
    expect(normalizeRegion("香港特别行政区")).toBe("香港");
  });

  it("英文名忽略大小写、空格与标点", () => {
    expect(normalizeRegion("United States of America")).toBe(
      "unitedstatesofamerica",
    );
    expect(normalizeRegion("  South   Korea ")).toBe("southkorea");
  });
});

describe("matchRegion", () => {
  const chinaIndex = buildRegionIndex(chinaFc);
  const worldIndex = buildRegionIndex(worldFc);

  it("中文地区名（含后缀）匹配中国要素", () => {
    expect(matchRegion("广东", chinaIndex)).toBe(0);
    expect(matchRegion("广东省", chinaIndex)).toBe(0);
    expect(matchRegion("内蒙古", chinaIndex)).toBe(1);
  });

  it("英文国家名匹配世界要素", () => {
    expect(matchRegion("China", worldIndex)).toBe(0);
    expect(matchRegion("united states", worldIndex)).toBe(-1);
  });

  it("常见国家中文别名可映射到英文要素", () => {
    expect(matchRegion("中国", worldIndex)).toBe(0);
    expect(matchRegion("美国", worldIndex)).toBe(1);
  });

  it("无匹配返回 -1", () => {
    expect(matchRegion("火星省", chinaIndex)).toBe(-1);
  });
});

describe("extent", () => {
  it("返回最小最大值，忽略非数值", () => {
    expect(extent([3, 1, 2, Number.NaN])).toEqual([1, 3]);
    expect(extent([])).toBeNull();
  });
});

describe("makeColorScale", () => {
  const scale = makeColorScale(0, 100, ["#000000", "#ffffff"]);

  it("缺失值返回无数据色", () => {
    expect(scale(null)).toBe(MAP_NO_DATA_COLOR);
    expect(scale(undefined)).toBe(MAP_NO_DATA_COLOR);
    expect(scale(Number.NaN)).toBe(MAP_NO_DATA_COLOR);
  });

  it("端点映射到色阶首尾", () => {
    expect(scale(0)).toBe("#000000");
    expect(scale(100)).toBe("#ffffff");
  });

  it("极值相同时取末端色", () => {
    const flat = makeColorScale(5, 5, ["#000000", "#ffffff"]);
    expect(flat(5)).toBe("#ffffff");
  });
});

describe("projection", () => {
  it("投影点落在画布范围内，且生成合法 path", () => {
    const proj = createFitProjection(chinaFc, 400, 300, 8);
    const [x, y] = proj.project(114, 24);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThanOrEqual(400);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(300);

    const path = featureToPath(chinaFc.features[0], proj);
    expect(path.startsWith("M")).toBe(true);
    expect(path.trimEnd().endsWith("Z")).toBe(true);
  });

  it("MultiPolygon 生成多段路径", () => {
    const proj = createFitProjection(chinaFc, 400, 300, 8);
    const path = featureToPath(chinaFc.features[1], proj);
    expect(path.split("Z").filter((s) => s.trim()).length).toBe(1);
  });
});

describe("detectScope", () => {
  const chinaIndex = buildRegionIndex(chinaFc);
  const worldIndex = buildRegionIndex(worldFc);

  it("省份数据识别为 china", () => {
    expect(detectScope(["广东", "内蒙古"], chinaIndex, worldIndex)).toBe(
      "china",
    );
  });

  it("国家数据识别为 world", () => {
    expect(detectScope(["China", "美国"], chinaIndex, worldIndex)).toBe(
      "world",
    );
  });
});
