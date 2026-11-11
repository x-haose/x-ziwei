//! MCP 工具面。三件工具的实现是 [`crate::service::App`]，这里只注册协议。

use rmcp::handler::server::router::tool::ToolRouter;
use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::{
    CallToolResult, ContentBlock, Implementation, ProtocolVersion, ServerCapabilities, ServerInfo,
};
use rmcp::{ErrorData as McpError, ServerHandler, tool, tool_handler, tool_router};
use serde::Serialize;
use serde_json::json;

use crate::error::Error;
use crate::service::{App, ChartRequest, LookupRequest, ReadRequest};

/// 一份工具实现，stdio 与 Streamable HTTP 共用。
#[derive(Clone)]
pub struct ZiweiMcp {
    /// 编排层。
    app: App,
    /// `#[tool_router]` 生成的路由表。
    tool_router: ToolRouter<Self>,
}

#[tool_router]
impl ZiweiMcp {
    /// 绑定同一份 [`App`]。
    pub fn new(app: App) -> Self {
        Self {
            app,
            tool_router: Self::tool_router(),
        }
    }

    /// 供契约测试列出工具名与 schema。
    pub fn router(&self) -> &ToolRouter<Self> {
        &self.tool_router
    }

    #[tool(
        name = "ziwei_chart",
        description = "紫微斗数排盘。给定出生日期、时辰与性别，返回本命盘语义化文本（Markdown）及语言无关 key。可选 target_date 同时返回运限。只返回盘面事实，不含断语。时辰：0 早子 00:00-00:59，1 丑 01:00-02:59，2 寅 03:00-04:59，3 卯 05:00-06:59，4 辰 07:00-08:59，5 巳 09:00-10:59，6 午 11:00-12:59，7 未 13:00-14:59，8 申 15:00-16:59，9 酉 17:00-18:59，10 戌 19:00-20:59，11 亥 21:00-22:59，12 晚子 23:00-23:59。23 点必须用 12，不要写成 0。也可用 clock=HH:MM。",
        annotations(read_only_hint = true, idempotent_hint = true, open_world_hint = false)
    )]
    async fn ziwei_chart(
        &self,
        Parameters(req): Parameters<ChartRequest>,
    ) -> Result<CallToolResult, McpError> {
        match self.app.chart(req).await {
            Ok(view) => Ok(tool_ok(view)),
            Err(err) => Ok(tool_err(err)),
        }
    }

    #[tool(
        name = "ziwei_read",
        description = "按问题取材。给定生辰、封闭 topic（self/overall/year/wealth/career/spouse/health/children/parents/siblings/friends/property/surface/spirit）与可选额外宫位，返回选中宫的事实文本、对得上的知识包原文 quotes、以及盘上有但包里没释义的 missing。断语只能抄 quotes 原文；missing 与返回里没有的星不准写。问流年用 topic=year 并给 target_date。",
        annotations(read_only_hint = true, idempotent_hint = true, open_world_hint = false)
    )]
    async fn ziwei_read(
        &self,
        Parameters(req): Parameters<ReadRequest>,
    ) -> Result<CallToolResult, McpError> {
        match self.app.read(req).await {
            Ok(slice) => Ok(tool_ok(slice)),
            Err(err) => Ok(tool_err(err)),
        }
    }

    #[tool(
        name = "ziwei_lookup",
        description = "按语言无关标识查知识包一条，用于核对原文。kind 为 star/pattern/palace/mutagen/concept，key 如 ziweiMaj、soulPalace、sihuaLu。键不存在则失败，不返回相近条目。",
        annotations(read_only_hint = true, idempotent_hint = true, open_world_hint = false)
    )]
    async fn ziwei_lookup(
        &self,
        Parameters(req): Parameters<LookupRequest>,
    ) -> Result<CallToolResult, McpError> {
        match self.app.lookup(req).await {
            Ok(entry) => Ok(tool_ok(entry)),
            Err(err) => Ok(tool_err(err)),
        }
    }
}

#[tool_handler]
impl ServerHandler for ZiweiMcp {
    fn get_info(&self) -> ServerInfo {
        ServerInfo::new(ServerCapabilities::builder().enable_tools().build())
            .with_server_info(Implementation::new("x-ziwei", env!("CARGO_PKG_VERSION")))
            .with_protocol_version(ProtocolVersion::V_2026_07_28)
            .with_instructions(
                "Zi Wei Dou Shu tools. Call ziwei_read for a question (topic + birth). \
             Call ziwei_chart only when the full natal chart is needed. \
             Call ziwei_lookup to verify one knowledge-pack sentence. \
             Never invent stars or quotes that the tools did not return. \
             Feed the model a Chinese chart; answer in the user's language."
                    .to_string(),
            )
    }
}

fn tool_ok<T: Serialize>(value: T) -> CallToolResult {
    let value = serde_json::to_value(&value).expect("tool payloads are JSON objects");
    CallToolResult::structured(value)
}

fn tool_err(err: Error) -> CallToolResult {
    let body = json!({
        "code": err.code.as_str(),
        "message": err.message,
        "retryable": err.code.retryable(),
    });
    let mut result = CallToolResult::error(vec![ContentBlock::text(body.to_string())]);
    result.structured_content = Some(body);
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pack::{PackPolicy, PackStore};
    use std::sync::Arc;

    fn mcp() -> ZiweiMcp {
        let packs = Arc::new(PackStore::new(PackPolicy::default()).unwrap());
        ZiweiMcp::new(App { packs })
    }

    #[test]
    fn registers_three_tools() {
        let mut names: Vec<_> = mcp()
            .router()
            .list_all()
            .into_iter()
            .map(|t| t.name.to_string())
            .collect();
        names.sort();
        assert_eq!(names, ["ziwei_chart", "ziwei_lookup", "ziwei_read"]);
    }

    #[test]
    fn chart_schema_mentions_late_zi() {
        let chart = mcp()
            .router()
            .list_all()
            .into_iter()
            .find(|t| t.name == "ziwei_chart")
            .unwrap();
        let desc = chart.description.unwrap_or_default();
        assert!(desc.contains("晚子") || desc.contains("12"));
        assert!(desc.contains("clock") || desc.contains("HH:MM") || desc.contains("23"));
    }
}
