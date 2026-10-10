# 项目规范：Mac BI Desktop (Tauri2 + Vite React，无Python、无DuckDB、无LLM)
目标：macOS桌面BI工具，类似PowerBI。支持本地CSV、Excel导入，远程SQL Server连接，拖拽仪表盘、图表可视化。

## 技术栈
- 桌面壳：Tauri 2
- 前端：Vite + React + TypeScript（SPA，禁止Next/Nuxt，禁止SSR）
- UI：shadcn/ui + Tailwind CSS
- 图表：Recharts
- 拖拽画布：react-flow
- CSV解析：papaparse
- Excel解析：sheetjs (xlsx)
- SQL Server：Rust tiberius + tokio，通过Tauri IPC调用
- 状态管理：Zustand + TanStack Query

## 模块职责
1. Tauri Rust
- macOS窗口、菜单栏、本地文件读写
- IPC命令：测试SQLServer连接、执行SQL查询
- 使用tiberius连接远程SQL Server，执行查询，返回数据集
- 业务数据计算尽量简单，只做查询转发，复杂计算交给SQL Server本身

2. React前端
- CSV/Excel文件上传预览，文件内容由Tauri读取，WebView内JS解析
- SQL Server连接配置面板（地址、端口、账号、密码、数据库名）
- SQL编辑器，执行查询，预览结果表格
- 拖拽仪表盘画布，图表配置、渲染
- 项目文件保存/加载 .biproj（保存连接信息、仪表盘布局）

## 强制约束
1. ❌ 不使用Python、FastAPI、sidecar
2. ❌ 不集成DuckDB，不内置本地数据库
3. ❌ 不做LLM、NL2SQL相关功能
4. SQL Server连接逻辑全部放在Rust，前端只通过IPC调用接口
5. CSV/Excel在WebView内解析，Tauri只负责读取本地文件二进制
6. 打包目标macOS .app，优化包体积
7. 禁止引入Next.js、Nuxt、Electron
