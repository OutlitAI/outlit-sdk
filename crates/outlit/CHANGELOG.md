# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0](https://github.com/OutlitAI/outlit-sdk/compare/outlit-v0.3.0...outlit-v0.4.0) - 2026-08-05

### Other

- [**breaking**] consume the Core-owned capability surface ([#176](https://github.com/OutlitAI/outlit-sdk/pull/176))

## [0.3.0](https://github.com/OutlitAI/outlit-sdk/compare/outlit-v0.2.2...outlit-v0.3.0) - 2026-07-30

### Other

- complete activation migration guidance ([#174](https://github.com/OutlitAI/outlit-sdk/pull/174))
- Add shared contact and company activation event CLI ([#164](https://github.com/OutlitAI/outlit-sdk/pull/164))
- Remove manual lifecycle and billing SDK events ([#160](https://github.com/OutlitAI/outlit-sdk/pull/160))
- Sync Rust README license
- Address README discovery review feedback
- Improve README discovery surfaces
- Trim derived stage docs detail
- Deprecate manual engaged inactive SDK calls
- Add Pi growth agent pretriage and notifications ([#112](https://github.com/OutlitAI/outlit-sdk/pull/112))

### Removed

- Remove manual lifecycle and billing builders and their `stage`/`billing` payload variants. Use ordinary `track()` events for product activity and verified integrations for billing state.

### Migration from 0.2

- To migrate activation tracking, replace `client.user().activate(...)` with `client.track("your_configured_event", identity)` at the point where your configured meaningful product event succeeds. Keep existing ordinary `track()` calls, identity, and customer attribution unchanged.
- Remove calls to the other lifecycle and billing builders. Outlit derives engagement and inactivity from tracked activity, and billing state comes from verified integrations.

## [0.2.2](https://github.com/OutlitAI/outlit-sdk/compare/outlit-v0.2.1...outlit-v0.2.2) - 2026-04-14

### Other

- refresh customer context and SDK guidance

## [0.2.0](https://github.com/OutlitAI/outlit-sdk/compare/outlit-v0.1.0...outlit-v0.2.0) - 2026-01-29

### Added

- add fingerprint support for anonymous event tracking

### Fixed

- format rust code and add changeset
- address code review feedback

### Other

- *(rust)* add payload compatibility tests
