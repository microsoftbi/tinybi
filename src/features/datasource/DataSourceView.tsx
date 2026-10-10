import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, Upload, Trash2, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { DataTable } from "@/components/DataTable";
import { useDatasetStore } from "@/stores/datasetStore";
import { importDataFile } from "@/lib/project";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SOURCE_LABEL: Record<string, string> = {
  csv: "CSV",
  excel: "Excel",
  sql: "SQL",
};

export function DataSourceView() {
  const datasets = useDatasetStore((s) => s.datasets);
  const removeDataset = useDatasetStore((s) => s.removeDataset);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  // 自动选中第一个 / 修正失效的选择
  useEffect(() => {
    if (datasets.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !datasets.some((d) => d.id === selectedId)) {
      setSelectedId(datasets[0].id);
    }
  }, [datasets, selectedId]);

  const selected = useMemo(
    () => datasets.find((d) => d.id === selectedId) ?? null,
    [datasets, selectedId],
  );

  async function handleImport() {
    setImporting(true);
    try {
      const ds = await importDataFile();
      if (ds) setSelectedId(ds.id);
    } finally {
      setImporting(false);
    }
  }

  function handleRemove(id: string, name: string) {
    removeDataset(id);
    toast.success(`已移除「${name}」`);
  }

  return (
    <div className="flex h-full min-h-0">
      {/* 左侧：数据源列表 */}
      <aside className="flex w-72 shrink-0 flex-col border-r">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Database className="h-4 w-4" />
            数据源
          </div>
          <Button size="sm" onClick={handleImport} disabled={importing}>
            <Upload className="h-4 w-4" />
            导入
          </Button>
        </div>
        <Separator />
        <ScrollArea className="flex-1">
          {datasets.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">
              尚未导入数据。点击「导入」选择 CSV / Excel 文件。
            </div>
          ) : (
            <ul className="p-2">
              {datasets.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(d.id)}
                    className={cn(
                      "group flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent",
                      selectedId === d.id && "bg-accent",
                    )}
                  >
                    <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{d.name}</span>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {SOURCE_LABEL[d.source] ?? d.source}
                    </Badge>
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="移除数据源"
                      className="hidden shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:block"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(d.id, d.name);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.stopPropagation();
                          handleRemove(d.id, d.name);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </aside>

      {/* 右侧：预览 */}
      <section className="flex min-w-0 flex-1 flex-col p-4">
        {selected ? (
          <>
            <div className="mb-3 flex items-center gap-3">
              <h2 className="truncate text-base font-semibold">{selected.name}</h2>
              <Badge variant="outline">{SOURCE_LABEL[selected.source] ?? selected.source}</Badge>
              <span className="text-xs text-muted-foreground">
                {selected.rows.length} 行 · {selected.columns.length} 列
              </span>
            </div>
            <div className="min-h-0 flex-1">
              <DataTable columns={selected.columns} rows={selected.rows} />
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <FileSpreadsheet className="h-10 w-10" />
            <p className="text-sm">导入 CSV / Excel 后在此预览数据</p>
            <Button variant="outline" onClick={handleImport} disabled={importing}>
              <Upload className="h-4 w-4" />
              导入数据文件
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
