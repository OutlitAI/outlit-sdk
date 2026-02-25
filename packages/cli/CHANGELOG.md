# @outlit/cli

## 1.0.1

### Patch Changes

- [#54](https://github.com/OutlitAI/outlit-sdk/pull/54) [`c0af82f`](https://github.com/OutlitAI/outlit-sdk/commit/c0af82fc667f6a6bfb73f7fa13df5b745e410730) Thanks [@rafa-thayto](https://github.com/rafa-thayto)! - Rewrite shell completions with subcommand and flag support, fix Unicode encoding for npm package, add ASCII fallback for non-Unicode terminals.

- [`36ec301`](https://github.com/OutlitAI/outlit-sdk/commit/36ec301f74f9fd4f83466c5ac456d0cd16442f9b) Thanks [@rafa-thayto](https://github.com/rafa-thayto)! - Add `-v` short flag as alias for `--version`.

## 1.0.0

### Major Changes

- [`8d97e72`](https://github.com/OutlitAI/outlit-sdk/commit/8d97e72da00c2ee3932814fb16b3fc6da82622a4) Thanks [@rafa-thayto](https://github.com/rafa-thayto)! - Fix credential leak in MCP setup (suppress subprocess output that included Authorization header), use outputError for pagination failures, and improve test isolation.
