//! 领域错误：调用方入参与出站依赖在此分类，适配器只做翻译。

use std::fmt;

use x_iztro::IztroError;

/// 机器可读的错误分类。HTTP / MCP 都用同一组 `code`，不解析文案。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErrorCode {
    /// 日期格式、存在性或公历范围非法。
    InvalidDate,
    /// 时辰序号不在 0–12。
    InvalidTimeIndex,
    /// 钟点 `HH:MM` 解析失败或超出 00:00–23:59。
    InvalidClock,
    /// `time_index` 与 `clock` 同时给出但指向不同时辰。
    TimeMismatch,
    /// 性别、历法、闰月、语言等其余入参非法。
    InvalidArgument,
    /// 封闭 topic 标识无法识别。
    UnknownTopic,
    /// 宫位 / 星耀 / 格局 / 四化 / 术语标识无法识别。
    UnknownKey,
    /// `year` topic 或显式运限缺少目标日期。
    MissingHoroscopeDate,
    /// 请求的知识包不在白名单（本地目录或 URL）。
    PackNotAllowed,
    /// 白名单内的包读不到（文件或 HTTP）；可重试。
    PackUnavailable,
    /// 内核或本进程本不该出现的状态。
    Internal,
    /// 单地址超过令牌桶；失败更快，不把打满伪装成成功。
    RateLimited,
}

impl ErrorCode {
    /// 稳定的对外标识，写入 JSON `error.code`。
    pub fn as_str(self) -> &'static str {
        match self {
            Self::InvalidDate => "invalid_date",
            Self::InvalidTimeIndex => "invalid_time_index",
            Self::InvalidClock => "invalid_clock",
            Self::TimeMismatch => "time_mismatch",
            Self::InvalidArgument => "invalid_argument",
            Self::UnknownTopic => "unknown_topic",
            Self::UnknownKey => "unknown_key",
            Self::MissingHoroscopeDate => "missing_horoscope_date",
            Self::PackNotAllowed => "pack_not_allowed",
            Self::PackUnavailable => "pack_unavailable",
            Self::Internal => "internal",
            Self::RateLimited => "rate_limited",
        }
    }

    /// 出站依赖故障为可重试；入参错误与不变量违反不可重试。
    pub fn retryable(self) -> bool {
        matches!(self, Self::PackUnavailable | Self::RateLimited)
    }
}

impl fmt::Display for ErrorCode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// 服务层唯一错误类型。适配器按 [`ErrorCode`] 映射状态码，不把内核类型泄漏出去。
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
#[error("{code}: {message}")]
pub struct Error {
    /// 机器可读分类。
    pub code: ErrorCode,
    /// 给人（和模型）看的说明，含怎么改。
    pub message: String,
}

impl Error {
    /// 构造一条领域错误。
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    /// 入参非法（性别、历法、闰月、语言等）。
    pub fn invalid_argument(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::InvalidArgument, message)
    }

    /// 标识无法识别。
    pub fn unknown_key(kind: &str, key: &str) -> Self {
        Self::new(ErrorCode::UnknownKey, format!("unknown {kind} key `{key}`"))
    }

    /// 出站包源失败，调用方可重试。
    pub fn pack_unavailable(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::PackUnavailable, message)
    }

    /// 不变量违反或内核 `Internal`。
    pub fn internal(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::Internal, message)
    }
}

impl From<IztroError> for Error {
    fn from(err: IztroError) -> Self {
        let code = match err.code() {
            "invalid_date" => ErrorCode::InvalidDate,
            "invalid_time_index" => ErrorCode::InvalidTimeIndex,
            "invalid_argument" => ErrorCode::InvalidArgument,
            _ => ErrorCode::Internal,
        };
        Self::new(code, err.to_string())
    }
}
