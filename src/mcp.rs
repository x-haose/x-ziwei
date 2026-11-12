//! MCP 工具面。五件工具的实现是 [`crate::service::App`]，这里只注册协议。
//!
//! 结果只放一个文本内容块，不放 `structuredContent`：有的客户端只把 `content` 交给模型，有的只交
//! `structuredContent`，同时给两份会让模型读到重复或不同的东西。排盘、运限、主题是 Markdown；
//! 目录与查询是 JSON 文本。服务说明里约束模型行为的句子排在工具介绍之前：有的客户端只取说明的开头一段。

use rmcp::handler::server::router::tool::ToolRouter;
use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::{
    CallToolResult, ContentBlock, Implementation, ProtocolVersion, ServerCapabilities, ServerInfo,
};
use rmcp::{ErrorData as McpError, ServerHandler, tool, tool_handler, tool_router};
use serde::Serialize;
use serde_json::json;

use crate::error::Error;
use crate::service::{
    App, CatalogRequest, ChartRequest, HoroscopeRequest, LookupRequest, TextView, TopicRequest,
};

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

    #[tool(
        name = "ziwei_get_natal_chart",
        title = "紫微斗数本命盘",
        description = "紫微斗数本命盘。给定出生历法、日期、时辰与性别，返回 Markdown 盘面事实：基本信息、十二宫（主星与亮度、辅星、杂耀、生年四化、三方四正、宫干飞化、十二神、大限）、命中的格局。detail=overview 只给总览表与格局。knowledge=summary/full 时在各宫与格局后附知识包释义，省略则只有事实。结果由 x-iztro 计算，不含解读结论。时辰：birth.clock 填 HH:MM，或 birth.time_index 填 0–12（0 早子 00:00–00:59，1 丑，2 寅 … 11 亥，12 晚子 23:00–23:59）；23 点是 12，不是 0。时辰未知先问用户，不要猜。",
        annotations(
            read_only_hint = true,
            destructive_hint = false,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    async fn ziwei_get_natal_chart(
        &self,
        Parameters(req): Parameters<ChartRequest>,
    ) -> Result<CallToolResult, McpError> {
        Ok(text_result(self.app.chart(req).await))
    }

    #[tool(
        name = "ziwei_get_horoscope",
        title = "紫微斗数运限",
        description = "紫微斗数运限。给定生辰与运限目标，返回 Markdown：各层的宫名对照、四化落宫、流耀与行运格局。目标给到哪个精度就返回到哪一层：只给 target.year 返回大限、小限、流年；给 target.date 再加流月、流日；再给 target.clock 或 target.time_index 才有流时。target.year 是农历年，用公历年份数字表示（2027 指 2027 年正月初一起的丁未年）；问某一年的运势用它，不要改填该年 1 月 1 日，春节前的日子仍属上一个农历年。用户说今年、这个月、今天，而你知道当前日期时直接填，不必追问；用户没给的日期或时辰不要替他编。只给 year 时，标题里的日期是该农历年六月初一，这三层取自那一天。knowledge=summary/full 时附流耀与格局的知识包释义。",
        annotations(
            read_only_hint = true,
            destructive_hint = false,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    async fn ziwei_get_horoscope(
        &self,
        Parameters(req): Parameters<HoroscopeRequest>,
    ) -> Result<CallToolResult, McpError> {
        Ok(text_result(self.app.horoscope(req).await))
    }

    #[tool(
        name = "ziwei_get_topic_palaces",
        title = "按主题取本命盘材料",
        description = "按主题取本命盘材料。主题（如婚恋、事业、财运）看哪些宫由知识包里该主题的定义决定，不是本服务的规定；定义可用 ziwei_lookup_knowledge kind=topic 查看，可用主题用 ziwei_list_knowledge kind=topic 列出。返回 Markdown：主题说明、选中各宫的事实与星耀释义、落在这些宫的格局、四化释义。只含本命宫位；运限用 ziwei_get_horoscope。这是知识包给的一种取材方式，调用方可以不用它，直接基于 ziwei_get_natal_chart 的完整盘面按自己的方法解读。",
        annotations(
            read_only_hint = true,
            destructive_hint = false,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    async fn ziwei_get_topic_palaces(
        &self,
        Parameters(req): Parameters<TopicRequest>,
    ) -> Result<CallToolResult, McpError> {
        Ok(text_result(self.app.topic(req).await))
    }

    #[tool(
        name = "ziwei_lookup_knowledge",
        title = "查知识包条目",
        description = "按语言无关标识查知识包条目原文，一次 1–20 个。kind 为 star / pattern / palace / mutagen / concept / topic。返回 JSON：条目的名称、正文与摘要；星耀另有门派属性与双星组合，格局另有古籍引文与成立条件，主题另有选宫定义；并注明知识包 id 与版本。标识取自 ziwei_list_knowledge，不接受译名；任一标识不存在则整次失败，不返回相近条目。",
        annotations(
            read_only_hint = true,
            destructive_hint = false,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    async fn ziwei_lookup_knowledge(
        &self,
        Parameters(req): Parameters<LookupRequest>,
    ) -> Result<CallToolResult, McpError> {
        Ok(json_result(self.app.lookup(req).await))
    }

    #[tool(
        name = "ziwei_list_knowledge",
        title = "知识包目录",
        description = "列出知识包目录：每个条目的标识与显示名，按 star / pattern / palace / mutagen / concept / topic 分段，可用 kind 只列一段。用它把盘面文本里的星名、宫名、格局名对应到 ziwei_lookup_knowledge 需要的标识，以及查看有哪些术语和主题。",
        annotations(
            read_only_hint = true,
            destructive_hint = false,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    async fn ziwei_list_knowledge(
        &self,
        Parameters(req): Parameters<CatalogRequest>,
    ) -> Result<CallToolResult, McpError> {
        Ok(json_result(self.app.catalog(req).await))
    }
}

#[tool_handler]
impl ServerHandler for ZiweiMcp {
    fn get_info(&self) -> ServerInfo {
        ServerInfo::new(ServerCapabilities::builder().enable_tools().build())
            .with_server_info(Implementation::new("x-ziwei", env!("CARGO_PKG_VERSION")))
            .with_protocol_version(ProtocolVersion::V_2026_07_28)
            .with_instructions(
                "Zi Wei Dou Shu (紫微斗数) chart facts and an open knowledge pack; the reading is yours. \
                 Chart facts are computed, not recalled: never state a star, palace, mutagen or pattern the tools did not return. \
                 Ask for a missing birth hour instead of guessing; 23:00-23:59 is time_index 12, not 0. \
                 Keep chart facts, knowledge-pack text and your own analysis distinguishable. \
                 Knowledge-pack text is one school's reference view, not the only reading; you may follow the user's own \
                 method or knowledge instead. \
                 Tools: ziwei_get_natal_chart returns the natal chart; ziwei_get_horoscope the decadal and yearly layers for a target year, \
                 plus monthly and daily for a date and hourly for an hour; ziwei_get_topic_palaces the palaces a knowledge-pack topic selects; \
                 ziwei_list_knowledge and ziwei_lookup_knowledge the knowledge pack itself."
                    .to_string(),
            )
    }
}

impl ZiweiMcp {
    /// 已注册工具的路由表。
    pub fn router(&self) -> &ToolRouter<Self> {
        &self.tool_router
    }
}

/// Markdown 正文；带释义时在文末注明知识包，模型据此区分事实与资料观点的出处。
fn text_result(result: Result<TextView, Error>) -> CallToolResult {
    match result {
        Ok(view) => {
            let mut text = view.text;
            if let Some(pack) = view.pack {
                text.push_str(&format!(
                    "\n---\n释义与主题定义来自知识包 {} {}\n",
                    pack.id, pack.version
                ));
            }
            CallToolResult::success(vec![ContentBlock::text(text)])
        }
        Err(err) => tool_err(err),
    }
}

fn json_result<T: Serialize>(result: Result<T, Error>) -> CallToolResult {
    match result {
        Ok(value) => {
            let text = serde_json::to_string(&value).expect("tool payloads serialize to JSON");
            CallToolResult::success(vec![ContentBlock::text(text)])
        }
        Err(err) => tool_err(err),
    }
}

fn tool_err(err: Error) -> CallToolResult {
    let body = json!({
        "code": err.code.as_str(),
        "message": err.message,
        "retryable": err.code.retryable(),
    });
    CallToolResult::error(vec![ContentBlock::text(body.to_string())])
}
