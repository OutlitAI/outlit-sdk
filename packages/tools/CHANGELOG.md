# @outlit/tools

## 0.2.1

### Patch Changes

- [#125](https://github.com/OutlitAI/outlit-sdk/pull/125) [`c488098`](https://github.com/OutlitAI/outlit-sdk/commit/c488098520191ee75dbfa8c61325393a4dd5ffbc) Thanks [@leo-paz](https://github.com/leo-paz)! - Add deterministic source listing CLI support and updated customer tool contracts.

## 0.2.0

### Minor Changes

- [#123](https://github.com/OutlitAI/outlit-sdk/pull/123) [`4e86cbb`](https://github.com/OutlitAI/outlit-sdk/commit/4e86cbb7af5f13e34654e132d7960f36bb3ffa7c) Thanks [@leo-paz](https://github.com/leo-paz)! - Add markdown notification bodies and explicit Slack destinations while keeping Slack as the default notifier.

## 0.1.3

### Patch Changes

- [#120](https://github.com/OutlitAI/outlit-sdk/pull/120) [`ad0340c`](https://github.com/OutlitAI/outlit-sdk/commit/ad0340c0974659ee5846460e9a5ff48579891f0a) Thanks [@leo-paz](https://github.com/leo-paz)! - Normalize customer context source type inputs case-insensitively so CRM, CRM_OPPORTUNITY, and OPPORTUNITY filters all resolve to the canonical OPPORTUNITY source type before CLI and SDK helper requests are sent.

## 0.1.2

### Patch Changes

- [#114](https://github.com/OutlitAI/outlit-sdk/pull/114) [`d0dff81`](https://github.com/OutlitAI/outlit-sdk/commit/d0dff81fbc11c030b728ccf057601c8437e6215d) Thanks [@leo-paz](https://github.com/leo-paz)! - Add CALENDAR to timeline channel tool contracts.

- [#110](https://github.com/OutlitAI/outlit-sdk/pull/110) [`85eeca2`](https://github.com/OutlitAI/outlit-sdk/commit/85eeca2f5c4ae3155665852c9294bf89ddbd36fb) Thanks [@leo-paz](https://github.com/leo-paz)! - Add OPPORTUNITY as the canonical CRM opportunity source type and accept CRM and CRM_OPPORTUNITY as input aliases.

- [#116](https://github.com/OutlitAI/outlit-sdk/pull/116) [`591dcaa`](https://github.com/OutlitAI/outlit-sdk/commit/591dcaa51cb8cee2d144de137f404b9a13cfd99a) Thanks [@leo-paz](https://github.com/leo-paz)! - Finish SDK-facing SQL view updates by aligning schema wording and example agent queries with public analytics views.

- [#115](https://github.com/OutlitAI/outlit-sdk/pull/115) [`842bbe8`](https://github.com/OutlitAI/outlit-sdk/commit/842bbe852b511dcabb50e610bfd13e69f99d8092) Thanks [@leo-paz](https://github.com/leo-paz)! - Update SQL tool contracts, CLI help, and Pi SQL guidance to use the public analytics views.

- [#117](https://github.com/OutlitAI/outlit-sdk/pull/117) [`dad1680`](https://github.com/OutlitAI/outlit-sdk/commit/dad168054587355d64ab50fec133cec005957627) Thanks [@leo-paz](https://github.com/leo-paz)! - Remove backend-specific SQL wording from public analytics view guidance.

## 0.1.1

### Patch Changes

- [#107](https://github.com/OutlitAI/outlit-sdk/pull/107) [`7de9c83`](https://github.com/OutlitAI/outlit-sdk/commit/7de9c8358b0eb622c93487c1ddb6046446873c13) Thanks [@leo-paz](https://github.com/leo-paz)! - Add the generic Slack notification action tool contract and expose `actionToolNames` for side-effectful tools.

- [#109](https://github.com/OutlitAI/outlit-sdk/pull/109) [`4548ed5`](https://github.com/OutlitAI/outlit-sdk/commit/4548ed5df90e1f3e99a3172b093b93b10c2fa0b7) Thanks [@leo-paz](https://github.com/leo-paz)! - Add generic Pi toolset helpers and improve Outlit query schema guidance for agent use.

## 0.1.0

### Minor Changes

- [#98](https://github.com/OutlitAI/outlit-sdk/pull/98) [`e7f42ca`](https://github.com/OutlitAI/outlit-sdk/commit/e7f42ca89fe4e072f32e18969ae111ebd7979f59) Thanks [@leo-paz](https://github.com/leo-paz)! - Add the public Outlit tools package and route CLI customer intelligence commands through it.

- [#103](https://github.com/OutlitAI/outlit-sdk/pull/103) [`8b61522`](https://github.com/OutlitAI/outlit-sdk/commit/8b61522d0b85a5164b6ab1efa01e0c182d79cab5) Thanks [@leo-paz](https://github.com/leo-paz)! - Add public customer fact type and category filters, reject anomaly detector filters, and expand Pi growth-agent examples.
