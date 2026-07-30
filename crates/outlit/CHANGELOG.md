# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
