use serde::Serialize;
use serde_json::{json, Value};

/// Phase-1 error body: exactly `{code, message}`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ApiError {
    pub code: &'static str,
    pub message: String,
}

impl ApiError {
    pub fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::new("internal", message)
    }

    pub fn rate_limited(message: impl Into<String>) -> Self {
        Self::new("rate_limited", message)
    }

    pub fn bad_request(message: impl Into<String>) -> Self {
        Self::new("bad_request", message)
    }

    /// Engine codes only. Face checks before `x-iztro` use [`Self::bad_request`].
    /// Internal detail stays off the wire.
    pub fn from_iztro(err: x_iztro::IztroError) -> Self {
        let code = err.code();
        let message = if code == "internal" {
            "internal error".to_string()
        } else {
            err.to_string()
        };
        Self { code, message }
    }

    pub fn body(&self) -> Value {
        json!({
            "code": self.code,
            "message": self.message,
        })
    }
}

#[derive(Serialize)]
struct ErrorBody<'a> {
    code: &'a str,
    message: &'a str,
}

impl ApiError {
    pub fn json_bytes(&self) -> Vec<u8> {
        serde_json::to_vec(&ErrorBody {
            code: self.code,
            message: &self.message,
        })
        .unwrap_or_else(|_| br#"{"code":"internal","message":"internal error"}"#.to_vec())
    }
}
