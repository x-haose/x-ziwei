//! 紫微斗数托管服务：把 x-iztro 的排盘事实编成 MCP / HTTP 工具。
//!
//! 安星、格局、农历换算全部在 x-iztro；本 crate 只做入参校验、按问题取材与协议适配。

#![deny(missing_docs)]

pub mod actions;
pub mod birth;
pub mod chart;
pub mod error;
pub mod http;
pub mod lookup;
pub mod mcp;
pub mod pack;
pub mod service;
pub mod slice;
pub mod topic;

pub use birth::{Birth, BirthRequest, Calendar, LeapKind};
pub use chart::ChartView;
pub use error::{Error, ErrorCode};
pub use lookup::{LookupEntry, LookupKind};
pub use pack::{PackPolicy, PackRef, PackStore};
pub use service::{App, ChartRequest, LookupRequest, ReadRequest};
pub use slice::{EntryKind, Quote, Slice};
pub use topic::Topic;
