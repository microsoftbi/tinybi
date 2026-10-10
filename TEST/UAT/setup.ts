import "@testing-library/jest-dom/vitest";

// jsdom 无布局引擎、无 ResizeObserver：为图表/画布提供稳定的容器尺寸，
// 使依赖 clientWidth/clientHeight 的组件（Recharts、ReportCanvas、MapChart）可渲染。
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
  ResizeObserverStub;

Object.defineProperty(HTMLElement.prototype, "clientWidth", {
  configurable: true,
  get() {
    return 800;
  },
});

Object.defineProperty(HTMLElement.prototype, "clientHeight", {
  configurable: true,
  get() {
    return 400;
  },
});
