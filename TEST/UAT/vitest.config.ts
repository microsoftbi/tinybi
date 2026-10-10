/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import path from "node:path";

// UAT 测试脚本独立配置：jsdom 环境 + TSX 自动 JSX 运行时 + @ 别名指向项目 src。
// 不复用根 vitest.config.ts（后者为 node 环境且仅收录 src/**/*.test.ts）。
const projectRoot = path.resolve(__dirname, "../..");

export default defineConfig({
  root: projectRoot,
  // 由 esbuild 按 TSX 语法转换；jsx: "automatic" 对应 tsconfig 的 jsx: react-jsx
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["TEST/UAT/**/*.test.{ts,tsx}"],
    setupFiles: [path.resolve(__dirname, "setup.ts")],
    // UAT 脚本按用例文件组织，串行执行便于观察输出
    fileParallelism: false,
  },
});
