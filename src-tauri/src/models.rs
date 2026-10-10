use serde::{Deserialize, Serialize};
use serde_json::Value;
use tiberius::{ColumnData, FromSql};

/// SQL Server 连接配置（前端 IPC 入参）
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SqlServerConfig {
    pub host: String,
    #[serde(default = "default_port")]
    pub port: u16,
    pub username: String,
    pub password: String,
    pub database: String,
    #[serde(default)]
    pub encrypt: bool,
}

fn default_port() -> u16 {
    1433
}

#[derive(Debug, Serialize)]
pub struct QueryColumn {
    pub name: String,
    #[serde(rename = "type")]
    pub col_type: String,
}

#[derive(Debug, Serialize)]
pub struct QueryResult {
    pub columns: Vec<QueryColumn>,
    pub rows: Vec<Vec<Value>>,
}

fn to_hex(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push_str(&format!("{b:02x}"));
    }
    s
}

/// 将 tiberius 的列值转换为 JSON 值。
///
/// 时间类型通过 `FromSql` trait 转换为 chrono 类型，再格式化为字符串。
pub fn column_data_to_json(data: &ColumnData<'static>) -> Value {
    match data {
        ColumnData::U8(Some(v)) => Value::from(*v),
        ColumnData::I16(Some(v)) => Value::from(*v),
        ColumnData::I32(Some(v)) => Value::from(*v),
        ColumnData::I64(Some(v)) => Value::from(*v),
        ColumnData::F32(Some(v)) => Value::from(*v as f64),
        ColumnData::F64(Some(v)) => Value::from(*v),
        ColumnData::Bit(Some(v)) => Value::from(*v),
        ColumnData::String(Some(v)) => Value::from(v.to_string()),
        ColumnData::Guid(Some(v)) => Value::from(v.to_string()),
        ColumnData::Binary(Some(v)) => Value::from(format!("0x{}", to_hex(v))),
        ColumnData::Numeric(Some(v)) => Value::from(v.to_string()),
        ColumnData::Xml(Some(v)) => Value::from(v.to_string()),
        ColumnData::DateTime(Some(_)) | ColumnData::DateTime2(Some(_)) => {
            match chrono::NaiveDateTime::from_sql(data) {
                Ok(Some(d)) => Value::from(d.format("%Y-%m-%d %H:%M:%S%.f").to_string()),
                _ => Value::Null,
            }
        }
        ColumnData::SmallDateTime(Some(_)) => match chrono::NaiveDateTime::from_sql(data) {
            Ok(Some(d)) => Value::from(d.format("%Y-%m-%d %H:%M:%S").to_string()),
            _ => Value::Null,
        },
        ColumnData::Date(Some(_)) => match chrono::NaiveDate::from_sql(data) {
            Ok(Some(d)) => Value::from(d.format("%Y-%m-%d").to_string()),
            _ => Value::Null,
        },
        ColumnData::Time(Some(_)) => match chrono::NaiveTime::from_sql(data) {
            Ok(Some(d)) => Value::from(d.format("%H:%M:%S%.f").to_string()),
            _ => Value::Null,
        },
        ColumnData::DateTimeOffset(Some(_)) => {
            match chrono::DateTime::<chrono::FixedOffset>::from_sql(data) {
                Ok(Some(d)) => Value::from(d.to_rfc3339()),
                _ => Value::Null,
            }
        }
        _ => Value::Null,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::borrow::Cow;

    #[test]
    fn hex_encoding() {
        assert_eq!(to_hex(&[0x00, 0x0f, 0xff]), "000fff");
    }

    #[test]
    fn null_becomes_json_null() {
        let data: ColumnData<'static> = ColumnData::I32(None);
        assert_eq!(column_data_to_json(&data), Value::Null);
    }

    #[test]
    fn integers_and_strings() {
        assert_eq!(
            column_data_to_json(&ColumnData::I32(Some(42))),
            Value::from(42)
        );
        assert_eq!(
            column_data_to_json(&ColumnData::String(Some(Cow::Borrowed("hi")))),
            Value::from("hi")
        );
        assert_eq!(
            column_data_to_json(&ColumnData::Bit(Some(true))),
            Value::from(true)
        );
    }
}
