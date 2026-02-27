# @outlit/cli

## 1.2.0

### Minor Changes

- [#58](https://github.com/OutlitAI/outlit-sdk/pull/58) [`d856a8d`](https://github.com/OutlitAI/outlit-sdk/commit/d856a8d0d4b3b63dac2641a4efe300edc3333316) Thanks [@rafa-thayto](https://github.com/rafa-thayto)! - Add `outlit setup skills` command to install the outlit-cli agent skill

## 1.1.0

### Minor Changes

- [#56](https://github.com/OutlitAI/outlit-sdk/pull/56) [`f435585`](https://github.com/OutlitAI/outlit-sdk/commit/f435585adc319efe1613b125ee570f6c408f5503) Thanks [@rafa-thayto](https://github.com/rafa-thayto)! - Add `-v` short flag as alias for `--version`, fix table formatting, and fix CLI binary release pipeline.

## 1.0.1

### Patch Changes

- [#54](https://github.com/OutlitAI/outlit-sdk/pull/54) [`c0af82f`](https://github.com/OutlitAI/outlit-sdk/commit/c0af82fc667f6a6bfb73f7fa13df5b745e410730) Thanks [@rafa-thayto](https://github.com/rafa-thayto)! - Rewrite shell completions with subcommand and flag support, fix Unicode encoding for npm package, add ASCII fallback for non-Unicode terminals.

- [`36ec301`](https://github.com/OutlitAI/outlit-sdk/commit/36ec301f74f9fd4f83466c5ac456d0cd16442f9b) Thanks [@rafa-thayto](https://github.com/rafa-thayto)! - Add `-v` short flag as alias for `--version`.

## 1.0.0

### Major Changes

- [`8d97e72`](https://github.com/OutlitAI/outlit-sdk/commit/8d97e72da00c2ee3932814fb16b3fc6da82622a4) Thanks [@rafa-thayto](https://github.com/rafa-thayto)! - Fix credential leak in MCP setup (suppress subprocess output that included Authorization header), use outputError for pagination failures, and improve test isolation.
