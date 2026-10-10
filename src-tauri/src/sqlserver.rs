use tiberius::{AuthMethod, Client, Config, EncryptionLevel};
use tokio::net::TcpStream;
use tokio_util::compat::{Compat, TokioAsyncWriteCompatExt};

use crate::models::{column_data_to_json, QueryColumn, QueryResult, SqlServerConfig};

type SqlClient = Client<Compat<TcpStream>>;

fn build_config(cfg: &SqlServerConfig) -> Config {
    let mut config = Config::new();
    config.host(&cfg.host);
    config.port(cfg.port);
    config.database(&cfg.database);
    config.authentication(AuthMethod::sql_server(&cfg.username, &cfg.password));
    if cfg.encrypt {
        config.encryption(EncryptionLevel::Required);
    } else {
        config.encryption(EncryptionLevel::NotSupported);
    }
    // MVP 面向内网实例：信任自签证书
    config.trust_cert();
    config
}

async fn open_client(cfg: &SqlServerConfig) -> Result<SqlClient, String> {
    let config = build_config(cfg);
    let tcp = TcpStream::connect(config.get_addr())
        .await
        .map_err(|e| format!("无法连接主机 {}:{} - {}", cfg.host, cfg.port, e))?;
    tcp.set_nodelay(true).map_err(|e| e.to_string())?;

    Client::connect(config, tcp.compat_write())
        .await
        .map_err(|e| format!("SQL Server 连接失败: {e}"))
}

/// 测试连接，成功返回服务端版本字符串。
#[tauri::command]
pub async fn test_sqlserver_connection(cfg: SqlServerConfig) -> Result<String, String> {
    let mut client = open_client(&cfg).await?;
    let row = client
        .simple_query("SELECT @@VERSION")
        .await
        .map_err(|e| format!("执行查询失败: {e}"))?
        .into_row()
        .await
        .map_err(|e| format!("读取结果失败: {e}"))?;

    let version: Option<String> = row.and_then(|r| r.get::<&str, usize>(0).map(|s| s.to_string()));
    Ok(version.unwrap_or_else(|| "连接成功".to_string()).trim().to_string())
}

/// 执行 SQL 查询并返回结果集。
#[tauri::command]
pub async fn execute_sql_query(cfg: SqlServerConfig, sql: String) -> Result<QueryResult, String> {
    let mut client = open_client(&cfg).await?;

    let stream = client
        .query(sql, &[])
        .await
        .map_err(|e| format!("执行 SQL 失败: {e}"))?;

    let result_sets = stream
        .into_results()
        .await
        .map_err(|e| format!("读取结果集失败: {e}"))?;

    let mut columns: Vec<QueryColumn> = Vec::new();
    let mut rows: Vec<Vec<serde_json::Value>> = Vec::new();

    for result_set in result_sets {
        for (i, row) in result_set.into_iter().enumerate() {
            if i == 0 {
                columns = row
                    .columns()
                    .iter()
                    .map(|c| QueryColumn {
                        name: c.name().to_string(),
                        col_type: format!("{:?}", c.column_type()),
                    })
                    .collect();
            }
            let values = row
                .into_iter()
                .map(|v| column_data_to_json(&v))
                .collect();
            rows.push(values);
        }
    }

    Ok(QueryResult { columns, rows })
}
