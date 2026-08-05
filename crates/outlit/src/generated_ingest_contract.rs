// Generated from packages/tools/src/generated/contracts.ts. Do not edit by hand.

pub const INGEST_METHOD: &str = "POST";
pub const INGEST_PATH_TEMPLATE: &str = "/api/i/v1/{publicKey}/events";
pub const INGEST_MAX_BATCH_SIZE: usize = 100;
#[allow(dead_code)]
pub const INGEST_EVENT_TYPES: &[&str] = &[
    "pageview",
    "form",
    "identify",
    "custom",
    "calendar",
    "engagement",
];

pub fn ingest_path(public_key: &str) -> String {
    INGEST_PATH_TEMPLATE.replace("{publicKey}", public_key)
}
