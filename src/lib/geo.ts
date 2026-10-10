// 填充地图的地理数据处理（纯函数，可单测）：
// GeoJSON 类型、区域名归一化与匹配、包围盒自适应投影、SVG 路径生成、数值色阶。

import type { MapRegion } from "@/types";

export type Position = [number, number];
export type Ring = Position[];
export type PolygonCoords = Ring[];
export type MultiPolygonCoords = Ring[][];

export interface GeoFeature {
  type: "Feature";
  properties: Record<string, unknown> & { name?: string };
  geometry:
    | { type: "Polygon"; coordinates: PolygonCoords }
    | { type: "MultiPolygon"; coordinates: MultiPolygonCoords };
}

export interface GeoFeatureCollection {
  type: "FeatureCollection";
  features: GeoFeature[];
}

/** 无可匹配数据时的填充色（与界面灰一致） */
export const MAP_NO_DATA_COLOR = "#e5e7eb";

/** 数值顺序色阶（浅蓝 → 深蓝，对齐 Power BI 默认主题蓝） */
export const MAP_COLOR_STOPS = ["#e8f1fb", "#9cc6f0", "#118dff", "#12239e"];

/** 中国行政区划后缀（按长度优先匹配，可重复剥离以处理「广西壮族自治区」） */
const CN_ADMIN_SUFFIXES = [
  "维吾尔自治区",
  "回族自治区",
  "壮族自治区",
  "特别行政区",
  "自治区",
  "自治州",
  "自治县",
  "省",
  "市",
  "地区",
  "盟",
  "县",
  "区",
];

/**
 * 归一化地区名：去空格/标点、忽略大小写、剥离中英文行政级别后缀。
 * 对数据值与 GeoJSON 名称使用同一函数，保证两侧一致。
 */
export function normalizeRegion(input: string): string {
  let s = (input ?? "").trim().toLowerCase();
  s = s.replace(/[\s.,'()_-]/g, "");
  s = s.replace(/^the/, "");
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of CN_ADMIN_SUFFIXES) {
      if (s.length > suffix.length && s.endsWith(suffix)) {
        s = s.slice(0, s.length - suffix.length);
        changed = true;
      }
    }
  }
  return s;
}

/** 常见国家/地区的中文名 → 世界地图英文名（键为中文名） */
const CN_COUNTRY_ALIAS: Record<string, string> = {
  中国: "China",
  美国: "United States of America",
  英国: "United Kingdom",
  法国: "France",
  德国: "Germany",
  意大利: "Italy",
  西班牙: "Spain",
  葡萄牙: "Portugal",
  荷兰: "Netherlands",
  比利时: "Belgium",
  瑞士: "Switzerland",
  奥地利: "Austria",
  瑞典: "Sweden",
  挪威: "Norway",
  丹麦: "Denmark",
  芬兰: "Finland",
  波兰: "Poland",
  希腊: "Greece",
  俄罗斯: "Russia",
  乌克兰: "Ukraine",
  土耳其: "Turkey",
  日本: "Japan",
  韩国: "South Korea",
  朝鲜: "North Korea",
  印度: "India",
  巴基斯坦: "Pakistan",
  孟加拉国: "Bangladesh",
  泰国: "Thailand",
  越南: "Vietnam",
  马来西亚: "Malaysia",
  印度尼西亚: "Indonesia",
  菲律宾: "Philippines",
  缅甸: "Myanmar",
  沙特阿拉伯: "Saudi Arabia",
  伊朗: "Iran",
  伊拉克: "Iraq",
  以色列: "Israel",
  埃及: "Egypt",
  南非: "South Africa",
  尼日利亚: "Nigeria",
  肯尼亚: "Kenya",
  埃塞俄比亚: "Ethiopia",
  摩洛哥: "Morocco",
  加拿大: "Canada",
  墨西哥: "Mexico",
  巴西: "Brazil",
  阿根廷: "Argentina",
  智利: "Chile",
  秘鲁: "Peru",
  哥伦比亚: "Colombia",
  澳大利亚: "Australia",
  新西兰: "New Zealand",
};

/** 由 GeoJSON 构造「归一化名称 → 要素下标」索引 */
export function buildRegionIndex(fc: GeoFeatureCollection): Map<string, number> {
  const index = new Map<string, number>();
  fc.features.forEach((f, i) => {
    const name = f.properties?.name;
    if (typeof name === "string") {
      const key = normalizeRegion(name);
      if (key && !index.has(key)) index.set(key, i);
    }
  });
  return index;
}

/** 将数据里的地区值匹配到要素下标；未命中返回 -1 */
export function matchRegion(
  value: string,
  index: Map<string, number>,
): number {
  const key = normalizeRegion(value);
  if (!key) return -1;
  const direct = index.get(key);
  if (direct !== undefined) return direct;
  const alias = CN_COUNTRY_ALIAS[key];
  if (alias) {
    const hit = index.get(normalizeRegion(alias));
    if (hit !== undefined) return hit;
  }
  return -1;
}

/** 数值范围；无有效值时返回 null */
export function extent(values: number[]): [number, number] | null {
  const nums = values.filter((v) => Number.isFinite(v));
  if (nums.length === 0) return null;
  let min = nums[0];
  let max = nums[0];
  for (const v of nums) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return [min, max];
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bl = Math.round(b1 + (b2 - b1) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

function interpolateStops(stops: string[], t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const segments = stops.length - 1;
  const scaled = clamped * segments;
  const i = Math.min(Math.floor(scaled), segments - 1);
  return mixHex(stops[i], stops[i + 1], scaled - i);
}

/**
 * 生成数值 → 颜色映射。缺失值/非数值返回 MAP_NO_DATA_COLOR；
 * 极值相同时统一取色阶末端色。
 */
export function makeColorScale(
  min: number,
  max: number,
  stops: string[] = MAP_COLOR_STOPS,
): (value: number | null | undefined) => string {
  return (value) => {
    if (value == null || !Number.isFinite(value)) return MAP_NO_DATA_COLOR;
    if (max === min) return stops[stops.length - 1];
    return interpolateStops(stops, (value - min) / (max - min));
  };
}

/** 墨卡托投影的 y 分量（纬度限制在 ±85° 避免极点发散）。
 *  返回值换算为「度」单位，与经度 x 量纲一致，避免纵横比失真。 */
function mercatorY(lat: number): number {
  const clamped = Math.max(-85, Math.min(85, lat));
  const rad = (clamped * Math.PI) / 180;
  return (Math.log(Math.tan(Math.PI / 4 + rad / 2)) * 180) / Math.PI;
}

export interface FitProjection {
  width: number;
  height: number;
  project(lon: number, lat: number): Position;
}

/** 遍历要素集合中的所有坐标点 */
function forEachPosition(
  fc: GeoFeatureCollection,
  cb: (lon: number, lat: number) => void,
): void {
  for (const f of fc.features) {
    const rings =
      f.geometry.type === "Polygon"
        ? f.geometry.coordinates
        : f.geometry.coordinates.flat();
    for (const ring of rings) {
      for (const [lon, lat] of ring) cb(lon, lat);
    }
  }
}

/** 按要素包围盒生成自适应投影：墨卡托 + 居中缩放至 width×height */
export function createFitProjection(
  fc: GeoFeatureCollection,
  width: number,
  height: number,
  padding = 8,
): FitProjection {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  forEachPosition(fc, (lon, lat) => {
    const x = lon;
    const y = -mercatorY(lat);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });

  const spanX = Math.max(maxX - minX, 1e-6);
  const spanY = Math.max(maxY - minY, 1e-6);
  const availW = Math.max(width - padding * 2, 1);
  const availH = Math.max(height - padding * 2, 1);
  const scale = Math.min(availW / spanX, availH / spanY);
  const offsetX = padding + (availW - spanX * scale) / 2;
  const offsetY = padding + (availH - spanY * scale) / 2;

  return {
    width,
    height,
    project(lon, lat) {
      const x = lon;
      const y = -mercatorY(lat);
      return [
        offsetX + (x - minX) * scale,
        offsetY + (y - minY) * scale,
      ] as Position;
    },
  };
}

function ringToPath(ring: Ring, proj: FitProjection): string {
  if (ring.length === 0) return "";
  const parts: string[] = [];
  ring.forEach(([lon, lat], i) => {
    const [x, y] = proj.project(lon, lat);
    parts.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
  });
  return `${parts.join(" ")} Z`;
}

/** 将要素（Polygon / MultiPolygon）转为 SVG path 字符串 */
export function featureToPath(f: GeoFeature, proj: FitProjection): string {
  const rings =
    f.geometry.type === "Polygon"
      ? f.geometry.coordinates
      : f.geometry.coordinates.flat();
  return rings.map((ring) => ringToPath(ring, proj)).join(" ");
}

/** 按数据值在 china / world 两个索引上的匹配数自动识别地理范围 */
export function detectScope(
  values: string[],
  chinaIndex: Map<string, number>,
  worldIndex: Map<string, number>,
): "china" | "world" {
  let china = 0;
  let world = 0;
  for (const v of values) {
    if (matchRegion(v, chinaIndex) >= 0) china++;
    else if (matchRegion(v, worldIndex) >= 0) world++;
  }
  return china > world ? "china" : "world";
}

const geoCache = new Map<"china" | "world", Promise<GeoFeatureCollection>>();

/** 懒加载并缓存内置 GeoJSON 边界（独立 chunk，不进主包） */
export function loadGeo(region: "china" | "world"): Promise<GeoFeatureCollection> {
  const cached = geoCache.get(region);
  if (cached) return cached;
  const promise = (
    region === "china"
      ? import("@/assets/geo/china.json")
      : import("@/assets/geo/world.json")
  ).then((mod) => {
    const m = mod as unknown as { default?: GeoFeatureCollection };
    return (m.default ?? (mod as unknown as GeoFeatureCollection));
  });
  geoCache.set(region, promise);
  return promise;
}

/** 解析最终使用的地理范围：显式指定则直接返回，auto 时按数据识别 */
export async function resolveScope(
  region: MapRegion | undefined,
  values: string[],
): Promise<"china" | "world"> {
  if (region === "china" || region === "world") return region;
  const [china, world] = await Promise.all([loadGeo("china"), loadGeo("world")]);
  return detectScope(values, buildRegionIndex(china), buildRegionIndex(world));
}
