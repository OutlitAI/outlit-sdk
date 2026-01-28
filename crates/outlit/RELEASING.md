# Releasing the Outlit Rust SDK

## Prerequisites

Install cargo-release:
```bash
cargo install cargo-release
```

## Release Process

From the repo root, run:

```bash
# Patch release (0.1.0 → 0.1.1) - bug fixes
cargo release patch -p outlit --execute

# Minor release (0.1.0 → 0.2.0) - new features
cargo release minor -p outlit --execute

# Major release (0.1.0 → 1.0.0) - breaking changes
cargo release major -p outlit --execute
```

This will:
1. Bump the version in `Cargo.toml`
2. Create a commit: `chore(rust): release outlit v0.2.0`
3. Create a tag: `outlit-v0.2.0`
4. Push commit and tag to origin

The GitHub Action (`.github/workflows/rust-release.yml`) will then:
1. Run tests
2. Publish to crates.io via trusted publishing

## First-Time Setup

Before the first release, you need to:

1. **Manually publish once** (to claim the crate name):
   ```bash
   cargo login  # paste token from https://crates.io/me
   cargo publish -p outlit
   ```

2. **Configure Trusted Publishing** at https://crates.io/crates/outlit/settings:
   - Owner: `OutlitAI`
   - Repository: `outlit-sdk`
   - Workflow: `rust-release.yml`
   - Environment: `release`

3. **Add team owners** (optional):
   ```bash
   cargo owner --add github:OutlitAI:developers
   ```

## Dry Run

To preview what will happen without making changes:
```bash
cargo release minor -p outlit
```

(Omit `--execute` to do a dry run)

## Canary Releases

Canary versions are published automatically when Rust files change on `main`.
Format: `0.1.0-canary.202501271200.abc1234`

Install canary:
```bash
cargo add outlit@0.1.0-canary.202501271200.abc1234
```
