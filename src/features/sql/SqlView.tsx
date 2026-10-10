import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { PlugZap, Play, Save, Trash2, Database, Table2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DataTable } from "@/components/DataTable";
import { executeSqlQuery, testSqlServerConnection } from "@/services/ipc";
import { useConnectionStore } from "@/stores/connectionStore";
import { queryResultToDataset } from "@/lib/project";
import { uid } from "@/lib/utils";
import type { QueryResult, SqlServerConfig } from "@/types";

export function SqlView() {
  const form = useConnectionStore((s) => s.form);
  const setForm = useConnectionStore((s) => s.setForm);
  const connections = useConnectionStore((s) => s.connections);
  const addConnection = useConnectionStore((s) => s.addConnection);
  const removeConnection = useConnectionStore((s) => s.removeConnection);
  const loadForm = useConnectionStore((s) => s.loadForm);

  const [sql, setSql] = useState("SELECT TOP 100 * FROM ");
  const [result, setResult] = useState<QueryResult | null>(null);

  const testMutation = useMutation({
    mutationFn: (cfg: SqlServerConfig) => testSqlServerConnection(cfg),
    onSuccess: (version) => {
      toast.success("连接成功", { description: version });
    },
    onError: (e) => toast.error("连接失败", { description: String(e) }),
  });

  const runMutation = useMutation({
    mutationFn: ({ cfg, q }: { cfg: SqlServerConfig; q: string }) =>
      executeSqlQuery(cfg, q),
    onSuccess: (res) => {
      setResult(res);
      toast.success(`查询完成：${res.rows.length} 行`);
    },
    onError: (e) => toast.error("查询失败", { description: String(e) }),
  });

  function handleSaveConnection() {
    if (!form.host || !form.username) {
      toast.error("请至少填写主机与用户名");
      return;
    }
    addConnection({
      id: uid("conn"),
      name: `${form.host}/${form.database || "master"}`,
      host: form.host,
      port: form.port,
      username: form.username,
      password: form.password,
      database: form.database,
      encrypt: form.encrypt,
    });
    toast.success("连接已保存（密码默认不落盘）");
  }

  function handleSaveAsDataset() {
    if (!result || result.columns.length === 0) return;
    queryResultToDataset(
      `SQL 查询 ${new Date().toLocaleTimeString("zh-CN")}`,
      result.columns,
      result.rows,
    );
    toast.success("已存为数据集，可在仪表盘中引用");
  }

  return (
    <div className="flex h-full min-h-0">
      {/* 连接配置 */}
      <aside className="flex w-80 shrink-0 flex-col border-r">
        <ScrollArea className="flex-1">
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Database className="h-4 w-4" />
              SQL Server 连接
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="host">主机地址</Label>
              <Input
                id="host"
                placeholder="192.168.1.10 或 host\\instance"
                value={form.host}
                onChange={(e) => setForm({ host: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="port">端口</Label>
                <Input
                  id="port"
                  type="number"
                  value={form.port}
                  onChange={(e) => setForm({ port: Number(e.target.value) || 1433 })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="database">数据库</Label>
                <Input
                  id="database"
                  placeholder="master"
                  value={form.database}
                  onChange={(e) => setForm({ database: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                value={form.username}
                onChange={(e) => setForm({ username: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ password: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <Label htmlFor="encrypt" className="cursor-pointer">
                要求加密连接
              </Label>
              <Switch
                id="encrypt"
                checked={form.encrypt}
                onCheckedChange={(encrypt) => setForm({ encrypt })}
              />
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => testMutation.mutate(form)}
                disabled={testMutation.isPending}
              >
                <PlugZap className="h-4 w-4" />
                测试连接
              </Button>
              <Button variant="outline" onClick={handleSaveConnection}>
                <Save className="h-4 w-4" />
                保存
              </Button>
            </div>

            {connections.length > 0 ? (
              <>
                <Separator />
                <div className="text-xs font-medium text-muted-foreground">
                  已保存的连接
                </div>
                <ul className="space-y-1">
                  {connections.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                    >
                      <button
                        type="button"
                        className="flex-1 truncate text-left"
                        onClick={() => loadForm(c)}
                      >
                        {c.name}
                      </button>
                      <button
                        type="button"
                        aria-label="删除连接"
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => removeConnection(c.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </ScrollArea>
      </aside>

      {/* 编辑器与结果 */}
      <section className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">SQL 查询</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => runMutation.mutate({ cfg: form, q: sql })}
                disabled={runMutation.isPending || !form.host}
              >
                <Play className="h-4 w-4" />
                执行
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSaveAsDataset}
                disabled={!result || result.columns.length === 0}
              >
                <Table2 className="h-4 w-4" />
                存为数据集
              </Button>
            </div>
          </div>
          <Textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            spellCheck={false}
            className="min-h-[140px] font-mono text-sm"
            placeholder="SELECT TOP 100 * FROM dbo.MyTable"
          />
        </div>

        <Separator />

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-semibold">结果</span>
            {result ? (
              <Badge variant="secondary">{result.rows.length} 行</Badge>
            ) : null}
          </div>
          <div className="min-h-0 flex-1">
            {result ? (
              <DataTable
                columns={result.columns.map((c) => ({ name: c.name, type: c.type }))}
                rows={result.rows}
              />
            ) : (
              <div className="flex h-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                填写连接信息并执行查询后在此查看结果
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
