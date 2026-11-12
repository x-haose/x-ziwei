//! 紫微斗数托管服务：把 x-iztro 的排盘事实与知识包编成 MCP / HTTP 工具。
//!
//! 安星、格局、农历换算、文本投影与主题选宫的执行全部在 x-iztro；主题看哪些宫由知识包定义。
//! 本 crate 只做入参校验、知识包加载与协议适配，不含解盘方法。

#![deny(missing_docs)]

pub mod birth;
pub mod chart;
pub mod error;
pub mod http;
pub mod knowledge;
pub mod mcp;
pub mod openapi;
pub mod pack;
pub mod service;

pub use error::{Error, ErrorCode};
pub use pack::{PackPolicy, PackRef, PackStore};
pub use service::App;
