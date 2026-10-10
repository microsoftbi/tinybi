import { invoke } from "@tauri-apps/api/core";
import type { QueryResult, SqlServerConfig } from "@/types";

/** 测试 SQL Server 连接，成功返回服务端版本字符串 */
export function testSqlServerConnection(cfg: SqlServerConfig): Promise<string> {
  return invoke<string>("test_sqlserver_connection", { cfg });
}

/** 执行 SQL 查询并返回结果集 */
export function executeSqlQuery(
  cfg: SqlServerConfig,
  sql: string,
): Promise<QueryResult> {
  return invoke<QueryResult>("execute_sql_query", { cfg, sql });
}
