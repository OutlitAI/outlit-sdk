# @outlit/cli

## 1.6.2

### Patch Changes

- [#107](https://github.com/OutlitAI/outlit-sdk/pull/107) [`e6d0927`](https://github.com/OutlitAI/outlit-sdk/commit/e6d092704287a7e49b274e847d5afa87080111df) Thanks [@leo-paz](https://github.com/leo-paz)! - Add the `outlit notify` command for sending Slack notifications from the CLI.

- Updated dependencies [[`7de9c83`](https://github.com/OutlitAI/outlit-sdk/commit/7de9c8358b0eb622c93487c1ddb6046446873c13), [`4548ed5`](https://github.com/OutlitAI/outlit-sdk/commit/4548ed5df90e1f3e99a3172b093b93b10c2fa0b7)]:
  - @outlit/tools@0.1.1

## 1.6.1

### Patch Changes

- [#105](https://github.com/OutlitAI/outlit-sdk/pull/105) [`fc51b27`](https://github.com/OutlitAI/outlit-sdk/commit/fc51b27ce89fe5309940ff276f72325c7329fa76) Thanks [@leo-paz](https://github.com/leo-paz)! - Fix the native CLI binary release by building local tool dependencies before release tests and avoiding top-level await in the CLI entrypoint.

## 1.6.0

### Minor Changes

- [#103](https://github.com/OutlitAI/outlit-sdk/pull/103) [`8b61522`](https://github.com/OutlitAI/outlit-sdk/commit/8b61522d0b85a5164b6ab1efa01e0c182d79cab5) Thanks [@leo-paz](https://github.com/leo-paz)! - Add public customer fact type and category filters, reject anomaly detector filters, and expand Pi growth-agent examples.

### Patch Changes

- [#98](https://github.com/OutlitAI/outlit-sdk/pull/98) [`e7f42ca`](https://github.com/OutlitAI/outlit-sdk/commit/e7f42ca89fe4e072f32e18969ae111ebd7979f59) Thanks [@leo-paz](https://github.com/leo-paz)! - Add the public Outlit tools package and route CLI customer intelligence commands through it.

- [#102](https://github.com/OutlitAI/outlit-sdk/pull/102) [`cefc519`](https://github.com/OutlitAI/outlit-sdk/commit/cefc51938b57771b9ba3ebb45dbf541519964d7e) Thanks [@leo-paz](https://github.com/leo-paz)! - Update CLI help examples to use current journey stages and ISO datetime ranges.

- Updated dependencies [[`e7f42ca`](https://github.com/OutlitAI/outlit-sdk/commit/e7f42ca89fe4e072f32e18969ae111ebd7979f59), [`8b61522`](https://github.com/OutlitAI/outlit-sdk/commit/8b61522d0b85a5164b6ab1efa01e0c182d79cab5)]:
  - @outlit/tools@0.1.0

## 1.5.0

### Minor Changes

- [#83](https://github.com/OutlitAI/outlit-sdk/pull/83) [`1038de4`](https://github.com/OutlitAI/outlit-sdk/commit/1038de4cd549b9105ed529680241a42bfb99bcd8) Thanks [@leo-paz](https://github.com/leo-paz)! - Add automatic CLI update notifications and a new `outlit upgrade` command.

- [#93](https://github.com/OutlitAI/outlit-sdk/pull/93) [`433121e`](https://github.com/OutlitAI/outlit-sdk/commit/433121e70858fbed8c90ce0747bc70173f5314bb) Thanks [@leo-paz](https://github.com/leo-paz)! - Refocus `outlit setup` on coding-agent skills, remove CLI-managed MCP setup subcommands, and add curated setup commands for Claude Code, Codex, Gemini CLI, Droid, OpenCode, and Pi.

### Patch Changes

- [#91](https://github.com/OutlitAI/outlit-sdk/pull/91) [`9cab5d1`](https://github.com/OutlitAI/outlit-sdk/commit/9cab5d17a08eeb0622ceb51957e8abb9be1a6340) Thanks [@leo-paz](https://github.com/leo-paz)! - Align CLI customer-surface commands with the shared tool contract registry and exact source lookup behavior.

- [#92](https://github.com/OutlitAI/outlit-sdk/pull/92) [`1d54582`](https://github.com/OutlitAI/outlit-sdk/commit/1d54582329b772447faf82eba799a17eb9a6090e) Thanks [@leo-paz](https://github.com/leo-paz)! - Align the CLI with the refactored customer context tool surface, including grouped search results, exact source retrieval, and split facts list/get commands.

- [#94](https://github.com/OutlitAI/outlit-sdk/pull/94) [`3943037`](https://github.com/OutlitAI/outlit-sdk/commit/394303767cc0deb905e2cc106ed9cba07b68acdc) Thanks [@leo-paz](https://github.com/leo-paz)! - Prevent `outlit setup` subcommands from falling through into the parent auto-detect installer when invoked through the CLI parser.

- [#95](https://github.com/OutlitAI/outlit-sdk/pull/95) [`8ac17c0`](https://github.com/OutlitAI/outlit-sdk/commit/8ac17c02088b50c704835991cfda072cb3e60a74) Thanks [@leo-paz](https://github.com/leo-paz)! - Add `outlit setup openclaw` as a first-class setup alias for installing the Outlit skill into OpenClaw.

- [#89](https://github.com/OutlitAI/outlit-sdk/pull/89) [`6186f79`](https://github.com/OutlitAI/outlit-sdk/commit/6186f7929ab4adead38a3b10d23749ba11ed9a49) Thanks [@leo-paz](https://github.com/leo-paz)! - Use the dedicated API key validation endpoint in CLI auth flows and improve upgrade-path compatibility in CI.

## 1.4.1

### Patch Changes

- [#76](https://github.com/OutlitAI/outlit-sdk/pull/76) [`6ca230c`](https://github.com/OutlitAI/outlit-sdk/commit/6ca230c075b0b5274055745ddf60bc5b44653637) Thanks [@leo-paz](https://github.com/leo-paz)! - fix: add PAST_DUE to billing status filter options in customers list command

- [#74](https://github.com/OutlitAI/outlit-sdk/pull/74) [`7e8aff5`](https://github.com/OutlitAI/outlit-sdk/commit/7e8aff5fd8f3fbb16af80c0b99b3c6d5c787ab4c) Thanks [@rafa-thayto](https://github.com/rafa-thayto)! - Remove legacy ~/clawd/ skill path fallback and rename skill from outlit-intelligence to outlit

- [#77](https://github.com/OutlitAI/outlit-sdk/pull/77) [`507a8c3`](https://github.com/OutlitAI/outlit-sdk/commit/507a8c32e0d796013b34b46f413c648353842365) Thanks [@leo-paz](https://github.com/leo-paz)! - Add --doc-types, --source-types, --source-type, and --source-id flags to `outlit search`. Query is now optional when --source-type and --source-id are provided for direct source lookup.

## 1.4.0

### Minor Changes

- [#72](https://github.com/OutlitAI/outlit-sdk/pull/72) [`06bd548`](https://github.com/OutlitAI/outlit-sdk/commit/06bd54886a254b42ba76d354c401022abd9cc0c0) Thanks [@rafa-thayto](https://github.com/rafa-thayto)! - Add integrations commands (list, add, remove, status) with API-key and OAuth provider flows

## 1.3.1

### Patch Changes

- [#70](https://github.com/OutlitAI/outlit-sdk/pull/70) [`dbafc63`](https://github.com/OutlitAI/outlit-sdk/commit/dbafc63ca6e80302c52364c5f21257eb06b6511e) Thanks [@leo-paz](https://github.com/leo-paz)! - fix: add PAST_DUE to billing status filter options in customers list command

## 1.3.0

### Minor Changes

- [#60](https://github.com/OutlitAI/outlit-sdk/pull/60) [`e0a2cf3`](https://github.com/OutlitAI/outlit-sdk/commit/e0a2cf3426bdf091e3df4cfa31c4acec8440ceb6) Thanks [@rafa-thayto](https://github.com/rafa-thayto)! - Install outlit-sdk skill alongside outlit-cli, and auto-install skills during batch setup

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
