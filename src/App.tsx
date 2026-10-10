import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Database, LayoutDashboard, TerminalSquare, FilePlus2, FolderOpen, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DataSourceView } from "@/features/datasource/DataSourceView";
import { SqlView } from "@/features/sql/SqlView";
import { DashboardView } from "@/features/dashboard/DashboardView";
import { useViewStore, type ViewKey } from "@/stores/viewStore";
import { importDataFile, openProject, saveProject } from "@/lib/project";
import { cn } from "@/lib/utils";

const NAV_ITEMS: Array<{ key: ViewKey; label: string; icon: typeof Database }> = [
  { key: "datasource", label: "数据源", icon: Database },
  { key: "sql", label: "SQL 查询", icon: TerminalSquare },
  { key: "dashboard", label: "仪表盘", icon: LayoutDashboard },
];

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export default function App() {
  const view = useViewStore((s) => s.view);
  const setView = useViewStore((s) => s.setView);
  const [saveOpen, setSaveOpen] = useState(false);
  const [includePassword, setIncludePassword] = useState(false);

  async function handleImport() {
    setView("datasource");
    await importDataFile();
  }

  async function handleSaveProject() {
    await saveProject(includePassword);
    setSaveOpen(false);
    setIncludePassword(false);
  }

  // 监听 Rust 菜单栏动作
  useEffect(() => {
    if (!isTauri()) return;
    let dispose: (() => void) | undefined;
    listen<string>("menu-action", (event) => {
      switch (event.payload) {
        case "import_file":
          void handleImport();
          break;
        case "open_project":
          void openProject();
          break;
        case "save_project":
          setSaveOpen(true);
          break;
        default:
          break;
      }
    }).then((unlisten) => {
      dispose = unlisten;
    });
    return () => dispose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen w-screen overflow-hidden bg-background">
        {/* 侧边导航 */}
        <nav className="flex w-16 shrink-0 flex-col items-center gap-1 border-r bg-muted/30 py-3">
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Tooltip key={item.key}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setView(item.key)}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                      view === item.key
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* 主区域 */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
            <span className="text-sm font-semibold">Mac BI Desktop</span>
            <Separator orientation="vertical" className="h-5" />
            <span className="text-sm text-muted-foreground">
              {NAV_ITEMS.find((n) => n.key === view)?.label}
            </span>
            <div className="flex-1" />
            <Button size="sm" variant="ghost" onClick={handleImport}>
              <FilePlus2 className="h-4 w-4" />
              导入数据
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void openProject()}>
              <FolderOpen className="h-4 w-4" />
              打开项目
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSaveOpen(true)}>
              <Save className="h-4 w-4" />
              保存项目
            </Button>
          </header>

          <main className="min-h-0 flex-1">
            {view === "datasource" ? (
              <DataSourceView />
            ) : view === "sql" ? (
              <SqlView />
            ) : (
              <DashboardView />
            )}
          </main>
        </div>
      </div>

      <Dialog
        open={saveOpen}
        onOpenChange={(open) => {
          setSaveOpen(open);
          if (!open) setIncludePassword(false);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>保存项目</DialogTitle>
            <DialogDescription>
              将连接配置、数据集与仪表盘保存为 .biproj 文件。
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div className="space-y-0.5">
              <Label htmlFor="include-password" className="cursor-pointer">
                包含连接密码
              </Label>
              <p className="text-xs text-muted-foreground">
                默认不写入密码；勾选后密码将以明文保存到文件。
              </p>
            </div>
            <Switch
              id="include-password"
              checked={includePassword}
              onCheckedChange={setIncludePassword}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void handleSaveProject()}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
