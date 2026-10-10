import { describe, expect, it } from "vitest";
import {
  clampRect,
  resizeRect,
  snapMove,
  snapResize,
  type Rect,
} from "./canvas";

const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

describe("snapMove", () => {
  it("无候选线吸附时保持原位且无辅助线", () => {
    const r = snapMove(rect(100, 100, 200, 100), [], 1000, 800);
    expect(r.rect).toEqual(rect(100, 100, 200, 100));
    expect(r.vLines).toEqual([]);
    expect(r.hLines).toEqual([]);
  });

  it("左边缘吸附到页面左边（x=0）", () => {
    const r = snapMove(rect(4, 50, 200, 100), [], 1000, 800);
    expect(r.rect.x).toBe(0);
    expect(r.vLines).toContain(0);
  });

  it("右边缘吸附到另一视觉对象的左边缘", () => {
    const r = snapMove(
      rect(603, 300, 200, 100),
      [rect(400, 0, 200, 100)],
      1000,
      800,
    );
    expect(r.rect.x).toBe(600);
    expect(r.vLines).toContain(600);
  });

  it("水平中线对齐（中心吸附）", () => {
    const r = snapMove(
      rect(103, 300, 200, 100),
      [rect(0, 0, 400, 100)],
      1000,
      800,
    );
    expect(r.rect.x).toBe(100);
    expect(r.vLines).toContain(200);
  });

  it("超出阈值（>6px）不吸附", () => {
    const r = snapMove(rect(610, 300, 100, 100), [], 1000, 800);
    expect(r.rect.x).toBe(610);
    expect(r.vLines).toEqual([]);
  });

  it("宽高与输入保持不变", () => {
    const r = snapMove(rect(4, 4, 320, 210), [], 1000, 800);
    expect(r.rect.w).toBe(320);
    expect(r.rect.h).toBe(210);
  });
});

describe("resizeRect", () => {
  it("东边向右扩展", () => {
    expect(resizeRect(rect(0, 0, 200, 100), "e", 50, 0)).toEqual(rect(0, 0, 250, 100));
  });

  it("西边向左扩展时保持右边缘固定", () => {
    expect(resizeRect(rect(100, 0, 200, 100), "w", -20, 0)).toEqual(rect(80, 0, 220, 100));
  });

  it("北边向上扩展时保持下边缘固定", () => {
    expect(resizeRect(rect(0, 100, 200, 200), "n", 0, -30)).toEqual(rect(0, 70, 200, 230));
  });

  it("不超过最小尺寸", () => {
    const r = resizeRect(rect(0, 0, 200, 200), "se", -500, -500);
    expect(r.w).toBe(160);
    expect(r.h).toBe(100);
  });

  it("右下角同时改变宽高", () => {
    expect(resizeRect(rect(0, 0, 200, 100), "se", 50, 50)).toEqual(rect(0, 0, 250, 150));
  });
});

describe("snapResize", () => {
  it("东边吸附到其它视觉对象左边缘", () => {
    const r = snapResize(
      rect(0, 0, 297, 100),
      "e",
      [rect(300, 0, 100, 100)],
      1000,
      800,
    );
    expect(r.rect.w).toBe(300);
    expect(r.vLines).toContain(300);
  });

  it("吸附会突破最小尺寸时放弃吸附", () => {
    const r = snapResize(
      rect(0, 0, 160, 100),
      "e",
      [rect(158, 0, 100, 100)],
      1000,
      800,
    );
    expect(r.rect.w).toBe(160);
    expect(r.vLines).toEqual([]);
  });

  it("仅移动的边参与吸附（东边缩放不影响纵轴）", () => {
    const r = snapResize(
      rect(0, 0, 200, 104),
      "e",
      [rect(0, 300, 100, 100)],
      1000,
      800,
    );
    expect(r.hLines).toEqual([]);
  });
});

describe("clampRect", () => {
  it("夹紧到页面范围内", () => {
    expect(clampRect(rect(-20, -20, 200, 100), 1000, 800)).toEqual(rect(0, 0, 200, 100));
    expect(clampRect(rect(950, 750, 200, 100), 1000, 800)).toEqual(rect(800, 700, 200, 100));
  });

  it("保证不小于最小尺寸", () => {
    const r = clampRect(rect(0, 0, 10, 10), 1000, 800);
    expect(r.w).toBe(160);
    expect(r.h).toBe(100);
  });
});
