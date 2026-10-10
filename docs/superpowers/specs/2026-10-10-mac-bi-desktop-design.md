# Mac BI Desktop 设计文档

- 日期：2026-10-10
- 状态：已获批（用户确认）
- 目标：macOS 桌面 BI 工具（类 PowerBI），支持本地 CSV/Excel 导入与远程 SQL Server 连接，拖拽式仪表盘与图表可视化。

## 1. 目标与非目标

### 目标（MVP）
- 导入本地 CSV / Excel 文件并预览、解析为数据集。
- 配置远程 SQL Server（仅 SQL 账号密码认证），测试连接、执行 SQL、预览结果，并可存为数据集。
- 在拖拽网格画布上创建图表部件，绑定数据集字段，渲染 Recharts 图表。
- 保存/加载项目文件 `.biproj`（连接信息、数据集定义、仪表盘布局）。

### 非目标（本次不做）
- Python / FastAPI / sidecar；DuckDB 或任何内置数据库；LLM / NL2SQL。
- 切片器与图表联动、多页仪表盘、下钻、定时刷新、导出报表。
- Windows / AD 集成认证。

## 2. 技术栈
| 层 | 选型 |
| --- | --- |
| 桌面壳 | Tauri 2 |
| 前端 | Vite + React + TypeScript（SPA，无 SSR） |
| UI | shadcn/ui + Tailwind CSS v3.4 |
| 图表 | Recharts |
| 仪表盘画布 | react-grid-layout |
| CSV | papaparse |
| Excel | sheetjs (xlsx) |
| SQL Server | Rust tiberius + tokio，经 Tauri IPC |
| 状态 | Zustand + TanStack Query |
| 测试 | Rust 单测 + 前端 vitest |

> 偏离说明：CLAUDE.md 指定仪表盘画布用 react-flow；经用户确认改用 react-grid-layout（更贴合看板式拖拽布局）。

## 3. 架构

两层进程，职责严格分离：

- **Tauri Rust 核心（`src-tauri/`）**：窗口与菜单栏、本地文件读写（官方 `plugin-dialog` + `plugin-fs`，底层 Rust）、SQL Server 连接与查询（`tiberius` + `tokio`）。只做查询转发，不做业务计算。
- **WebView React SPA（`src/`）**：全部 UI、CSV/Excel 解析（WebView 内 JS）、状态管理、仪表盘渲染。前端不直接连数据库，仅经 IPC 调用。

前端分层（依赖方向自上而下，自下而上不反向依赖）：
`lib/`（纯函数：解析、聚合、格式化）← `services/`（类型化 IPC 封装）← `stores/`（Zustand）← `features/`（业务页面）← `components/ui/`（shadcn 原子组件）。

## 4. 目录结构
```
TINYBI/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── sqlserver.rs      # tiberius 连接/查询
│   │   └── models.rs         # SqlServerConfig / QueryResult
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/
│   ├── components/ui/        # shadcn 组件
│   ├── components/app-shell/ # 侧边导航等布局
│   ├── features/
│   │   ├── datasource/       # 导入 + 数据预览
│   │   ├── sql/              # 连接配置 + SQL 编辑器 + 结果
│   │   └── dashboard/        # 画布 + 图表配置 + 渲染
│   ├── services/ipc.ts       # invoke 封装
│   ├── stores/               # dataset / connection / dashboard
│   ├── lib/                  # csv.ts xlsx.ts aggregate.ts chart.ts format.ts
│   ├── types.ts
│   ├── App.tsx
│   └── main.tsx
└── docs/superpowers/specs/
```

## 5. 数据流

### 导入
1. 用户点击导入 → `plugin-dialog` 选文件。
2. `plugin-fs` `readFile` 读取 `Uint8Array`（Rust 负责二进制读取）。
3. CSV → papaparse；Excel → sheetjs，在 WebView 内解析。
4. 归一化为 `Dataset` → 存入 Zustand。
5. 数据预览表格展示；仪表盘部件消费该数据集。

### SQL
1. 连接配置面板填写 `SqlServerConfig`。
2. `invoke('test_sqlserver_connection', { cfg })` → Rust 连接并返回服务端版本字符串。
3. SQL 编辑器提交 → `invoke('execute_sql_query', { cfg, sql })` → 经 TanStack Query 缓存。
4. 结果预览表格展示；可「存为数据集」供仪表盘使用（转换 `QueryResult` → `Dataset`）。

## 6. IPC 契约
```ts
interface SqlServerConfig {
  host: string;
  port: number;          // 默认 1433
  username: string;
  password: string;
  database: string;
  encrypt: boolean;      // 是否要求加密连接
}

interface QueryColumn { name: string; type: string }

interface QueryResult {
  columns: QueryColumn[];
  rows: (string | number | boolean | null)[][];
}

// 成功返回服务端版本；失败返回错误信息
test_sqlserver_connection(cfg: SqlServerConfig): Promise<string>
execute_sql_query(cfg: SqlServerConfig, sql: string): Promise<QueryResult>
```
- 命令名（Rust `#[tauri::command]`）：`test_sqlserver_connection`、`execute_sql_query`。
- 错误统一以 `Result<T, String>` 返回，前端捕获并提示。
- 文件读/写经官方插件，不自定义命令。

## 7. 数据模型

```ts
type CellValue = string | number | boolean | null;

interface Column { name: string; type: 'string' | 'number' | 'boolean' | 'date' | 'unknown' }

interface Dataset {
  id: string;
  name: string;
  source: 'csv' | 'excel' | 'sql';
  columns: Column[];
  rows: CellValue[][];
  createdAt: string;
}

type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'scatter' | 'table' | 'kpi';
type AggregateFn = 'sum' | 'count' | 'avg' | 'min' | 'max' | 'none';

interface WidgetEncoding {
  dimension?: string;   // x 轴 / 分类字段
  measures: { field: string; agg: AggregateFn }[]; // 度量
  series?: string;      // 分组/系列字段（可选）
}

interface WidgetLayout { x: number; y: number; w: number; h: number }

interface ChartWidget {
  id: string;
  type: ChartType;
  title: string;
  datasetId: string;
  encoding: WidgetEncoding;
  layout: WidgetLayout;
}

interface Dashboard {
  id: string;
  name: string;
  widgets: ChartWidget[];
}

interface ConnectionConfig extends SqlServerConfig { id: string; name: string }
```

### `.biproj` 格式
```json
{
  "version": 1,
  "connections": [ { "id": "...", "name": "...", "host": "...", "port": 1433,
                     "username": "...", "database": "...", "encrypt": true } ],
  "datasets": [ { "id": "...", "name": "...", "source": "csv",
                  "columns": [], "rows": [], "createdAt": "..." } ],
  "dashboards": [ { "id": "...", "name": "...", "widgets": [] } ]
}
```
- **密码默认不写入**：保存对话框提供「包含密码」复选，默认关闭。未保存密码的连接加载后需重新输入。

## 8. 模块设计

### Rust
- `models.rs`：`SqlServerConfig`、`QueryResult`，`serde` 派生；tiberius 列值 → JSON 转换函数（含 `decimal`/`datetime`/`nullable` 处理），带单测。
- `sqlserver.rs`：
  - `connect(cfg)`：构造 tiberius `Config`（host/port/database/用户名密码；`encrypt` 决定 `EncryptionLevel`），`TcpStream` → `tokio_util::compat` → `Client::connect`。
  - `test_sqlserver_connection`：连接后执行 `SELECT @@VERSION` 返回版本串。
  - `execute_sql_query`：执行用户 SQL，收集列元数据与行数据，转 `QueryResult`。
  - 连接按调用创建并释放（MVP 不做连接池）。
- `lib.rs`：`Builder` 注册插件与两个命令；菜单栏（打开/保存项目、导入文件）。
- `tauri.conf.json`：`bundle.targets = ["app", "dmg"]`；release profile 开启 `lto`、`opt-level = "z"`、`strip`、`panic = "abort"` 以优化体积。

### 前端
- `lib/csv.ts` / `lib/xlsx.ts`：`parseFile(bytes, ext) -> Dataset`，含类型推断（number/date/string）。
- `lib/aggregate.ts`：`aggregate(dataset, encoding) -> 图表就绪数据`，实现分组与 sum/count/avg/min/max。
- `lib/chart.ts`：`ChartWidget` → Recharts `data` + `series` 描述。
- `services/ipc.ts`：类型化封装 `invoke`。
- `stores/`：`useDatasetStore`、`useConnectionStore`、`useDashboardStore`、`useViewStore`。
- `features/datasource`：导入按钮、数据集列表、预览表格。
- `features/sql`：连接配置表单、测试连接、SQL 编辑器、结果预览、存为数据集。
- `features/dashboard`：`react-grid-layout` 画布、新增部件、部件配置抽屉（选数据集/图表类型/字段/聚合）、Recharts 渲染、`.biproj` 保存/加载。

## 9. 错误处理
- 文件解析失败：捕获并 toast 提示，不破坏现有数据集。
- SQL 连接/查询失败：Rust 返回错误字符串，前端 toast + 结果区展示错误详情。
- `.biproj` 版本不匹配：提示并拒绝加载或尽力兼容（version 字段判断）。
- 边界：空数据集、无匹配字段、除零等聚合边界做兜底。

## 10. 测试策略
- **Rust**：`models.rs` 值转换单测；`cargo check` / `cargo clippy` 通过。
- **前端**：vitest 覆盖 `csv/xlsx` 解析与 `aggregate`；`pnpm build` 通过（tsc + vite）。
- **端到端（手动）**：`pnpm tauri dev` → 导入示例 CSV → 建图 → 保存/加载 `.biproj` → 连接 SQL Server（需外部实例）执行查询。

## 11. 风险与取舍
- tiberius 加密配置与自签证书：`encrypt=false` 时用 `NotSupported`，`encrypt=true` 用 `Required`，兼容常见内网实例。
- 大结果集内存：MVP 不限制但提示；后续可加分页。
- 偏离 CLAUDE.md 的 react-flow（见第 2 节偏离说明）。
