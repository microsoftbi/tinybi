import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

export interface PickedFile {
  path: string;
  name: string;
  bytes: Uint8Array;
}

function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/** 读取本地文件原始字节（由 Tauri 完成读取） */
async function readFileBytes(path: string): Promise<Uint8Array> {
  const buffer = await invoke<ArrayBuffer | number[]>("read_file_bytes", { path });
  if (buffer instanceof ArrayBuffer) return new Uint8Array(buffer);
  return new Uint8Array(buffer);
}

/** 读取本地文本文件 */
async function readTextFile(path: string): Promise<string> {
  return invoke<string>("read_text_file", { path });
}

/** 写入文本文件（由 Tauri 完成写入） */
async function writeTextFile(path: string, contents: string): Promise<void> {
  await invoke("write_text_file", { path, contents });
}

/** 选择本地 CSV / Excel 文件并读取其二进制 */
export async function pickDataFile(): Promise<PickedFile | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [
      { name: "数据文件", extensions: ["csv", "xlsx", "xls"] },
      { name: "CSV", extensions: ["csv"] },
      { name: "Excel", extensions: ["xlsx", "xls"] },
    ],
  });

  if (!selected || typeof selected !== "string") return null;

  const bytes = await readFileBytes(selected);
  return { path: selected, name: baseName(selected), bytes };
}

/** 弹出保存对话框并写入文本 */
export async function saveTextFile(
  contents: string,
  defaultName: string,
): Promise<string | null> {
  const path = await save({
    defaultPath: defaultName,
    filters: [{ name: "BI 项目", extensions: ["biproj"] }],
  });
  if (!path) return null;
  await writeTextFile(path, contents);
  return path;
}

/** 选择 .biproj 文件并读取文本 */
export async function pickProjectFile(): Promise<{ path: string; text: string } | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "BI 项目", extensions: ["biproj", "json"] }],
  });
  if (!selected || typeof selected !== "string") return null;
  const text = await readTextFile(selected);
  return { path: selected, text };
}
