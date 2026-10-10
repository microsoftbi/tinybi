import { toast } from "sonner";
import type { BiProject, CellValue, Dataset } from "@/types";
import { PROJECT_VERSION } from "@/types";
import { pickDataFile, pickProjectFile, saveTextFile } from "@/services/files";
import { parseCsv } from "./csv";
import { parseExcel } from "./xlsx";
import { uid } from "./utils";
import { MIN_WIDGET_H, MIN_WIDGET_W } from "./canvas";
import { useDatasetStore } from "@/stores/datasetStore";
import { useConnectionStore } from "@/stores/connectionStore";
import { useDashboardStore } from "@/stores/dashboardStore";

/** 选择本地文件 → WebView 内解析 → 存入数据源仓库 */
export async function importDataFile(): Promise<Dataset | null> {
  let picked;
  try {
    picked = await pickDataFile();
  } catch (e) {
    toast.error(`选择文件失败：${String(e)}`);
    return null;
  }
  if (!picked) return null;

  const ext = picked.name.split(".").pop()?.toLowerCase() ?? "";
  try {
    let ds: Dataset;
    if (ext === "xlsx" || ext === "xls") {
      ds = parseExcel(picked.bytes, picked.name);
    } else {
      const text = new TextDecoder("utf-8").decode(picked.bytes);
      ds = parseCsv(text, picked.name);
    }
    useDatasetStore.getState().addDataset(ds);
    toast.success(`已导入「${ds.name}」：${ds.rows.length} 行`);
    return ds;
  } catch (e) {
    toast.error(`解析文件失败：${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/** 将查询结果（列 + 行）转成数据集并入库 */
export function queryResultToDataset(
  name: string,
  columns: Array<{ name: string; type: string }>,
  rows: CellValue[][],
): Dataset {
  const ds: Dataset = {
    id: uid("ds"),
    name,
    source: "sql",
    columns: columns.map((c) => ({ name: c.name, type: "unknown" })),
    rows,
    createdAt: new Date().toISOString(),
  };
  useDatasetStore.getState().addDataset(ds);
  return ds;
}

/**
 * 从各仓库收集当前项目快照。
 * @param includePassword 是否把连接密码写入项目文件（默认 false，密码不落盘）
 */
export function buildProject(includePassword = false): BiProject {
  const connections = useConnectionStore.getState().connections.map((c) => {
    if (includePassword) return { ...c };
    return {
      id: c.id,
      name: c.name,
      host: c.host,
      port: c.port,
      username: c.username,
      database: c.database,
      encrypt: c.encrypt,
    };
  });
  return {
    version: PROJECT_VERSION,
    connections,
    datasets: useDatasetStore.getState().datasets,
    dashboards: useDashboardStore.getState().dashboards,
  };
}

/**
 * 版本迁移：v1 的布局使用网格单位（cols=12 / rowHeight=40），
 * v2 改为绝对像素坐标，此处按列宽 ≈115px、行高 ≈52px 换算。
 */
export function migrateProject(project: BiProject): BiProject {
  if (project.version >= PROJECT_VERSION) return project;
  const dashboards = (project.dashboards ?? []).map((d) => ({
    ...d,
    widgets: d.widgets.map((w) => ({
      ...w,
      layout: {
        x: Math.round(w.layout.x * 115),
        y: Math.round(w.layout.y * 52),
        w: Math.max(MIN_WIDGET_W, Math.round(w.layout.w * 115) - 12),
        h: Math.max(MIN_WIDGET_H, Math.round(w.layout.h * 52) - 12),
      },
    })),
  }));
  return { ...project, version: PROJECT_VERSION, dashboards };
}

/** 将项目快照写入各仓库 */
export function applyProject(project: BiProject): void {
  useConnectionStore.getState().setConnections(project.connections ?? []);
  useDatasetStore.getState().setDatasets(project.datasets ?? []);
  const dashboards = project.dashboards ?? [];
  if (dashboards.length > 0) {
    useDashboardStore.getState().setDashboards(dashboards);
  } else {
    useDashboardStore.getState().reset();
  }
}

/** 保存 .biproj 项目文件 */
export async function saveProject(includePassword = false): Promise<boolean> {
  try {
    const json = JSON.stringify(buildProject(includePassword), null, 2);
    const path = await saveTextFile(json, "未命名项目.biproj");
    if (!path) return false;
    toast.success(`项目已保存至 ${path}`, {
      description: includePassword ? "已包含连接密码（请注意文件安全）" : "密码未写入",
    });
    return true;
  } catch (e) {
    toast.error(`保存失败：${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}

/** 打开 .biproj 项目文件并载入 */
export async function openProject(): Promise<boolean> {
  let picked;
  try {
    picked = await pickProjectFile();
  } catch (e) {
    toast.error(`打开失败：${String(e)}`);
    return false;
  }
  if (!picked) return false;

  try {
    const project = JSON.parse(picked.text) as BiProject;
    if (typeof project !== "object" || project === null) {
      throw new Error("项目文件格式不正确");
    }
    if (typeof project.version !== "number") {
      throw new Error("项目文件缺少版本号");
    }
    if (project.version > PROJECT_VERSION) {
      toast.error("无法打开项目", {
        description: `项目版本 ${project.version} 高于当前支持的版本 ${PROJECT_VERSION}，请升级应用`,
      });
      return false;
    }
    applyProject(migrateProject(project));
    toast.success("项目已加载");
    return true;
  } catch (e) {
    toast.error(`解析项目失败：${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}
