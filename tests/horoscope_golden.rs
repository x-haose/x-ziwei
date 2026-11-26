//! 运限的金标（tests/fixtures/horoscope）：网页对话的运限工具与这里逐字比对，服务端同样要逐字一致，
//! 两边对同一目标写到同一层。
use std::sync::Arc;

use serde_json::json;
use x_ziwei::service::HoroscopeRequest;
use x_ziwei::{App, PackPolicy, PackStore};

#[tokio::test]
async fn horoscope_text_matches_golden() {
    let app = App {
        packs: Arc::new(PackStore::new(PackPolicy::default()).unwrap()),
    };
    let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/horoscope");
    for (name, target) in [
        ("year", json!({"year": 2026})),
        ("month", json!({"year": 2026, "month": 7})),
        ("day", json!({"date": "2026-11-26"})),
        ("hour", json!({"date": "2026-11-26", "clock": "23:10"})),
    ] {
        let req: HoroscopeRequest = serde_json::from_value(json!({
            "birth": {"calendar": "solar", "date": "2000-8-16", "time_index": 2, "gender": "female"},
            "target": target,
        }))
        .unwrap();
        let text = app.horoscope(req).await.unwrap().text;
        let golden = std::fs::read_to_string(dir.join(format!("{name}.md"))).unwrap();
        assert_eq!(text, golden, "{name}");
    }
}
