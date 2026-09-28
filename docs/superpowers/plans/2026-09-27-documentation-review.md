# Final prose review: all 55 public routes

Reviewer: Opus 5.5, independent critic. Read-only; nothing in the repository was written.
Checked: the working tree of `docs/documentation-update` as of 2026-09-27, rendered on the local preview at http://localhost:3000.
Judged against: the initial critique and lead decisions recorded during this task. The decisions take precedence.
Scope: all 55 nav routes (§5). §1–4 cover the first 31 routes (writer fixing now). §7 covers the remaining 24 routes and the diagram visual confirmation. Home is stable and was reviewed earlier (critique §9).

Line numbers refer to the current files. I left out anything that is only cosmetic preference, and every fix below keeps the exact technical caveats.

---

## 1. P1: fix before ship (wrong, contradictory, or violates a decision)

| # | Where | Finding | Suggested fix |
|---|---|---|---|
| 1 | `integrations/overview.mdx:84` | The Support and meetings card description still lists **Ergo**. The decision says to remove the unimplemented Ergo. The target page (`support-and-meetings`) no longer mentions it. | Change to "Pylon, Gong, Fireflies, Granola, Google Calendar". |
| 2 | Settings label split | The same settings page has two names. **"Website Visitors"** appears in `getting-started/overview.mdx:36` and `product/workspace-access.mdx:54`. **"Website Tracking"** appears in `tracking/quickstart.mdx:6,59`, `tracking/browser/script.mdx:50,420` and `tracking/browser/npm.mdx:46`. A CS reader following the quickstart won't find the page the overview names. | Use the app's exact label everywhere. The URL `/settings/workspace/tracking` suggests "Website Tracking", but confirm it in the app. |
| 3 | `tracking/browser/calendar-embeds.mdx:50-75` | Accuracy. The webhook recipe calls server `outlit.identify({ email })`, then L75 claims "All three events are linked to the same visitor." The Node SDK deliberately drops `visitorId` from server events (`packages/node/src/client.ts:273-278`). An email-only server identify therefore links the anonymous browser booking only if that browser visitor is also identified with the same email. The claim is unconditional as written. | Qualify L75. For example: "The booking joins the person's profile once the browser visitor is identified with the same email (for example, through a form or `identify()` call)." Don't promise a join the SDK can't make. |
| 4 | `calendar-embeds.mdx:27` vs `:72` | One event, two names: "Meeting Requested" activity (L27) and **Calendar Booking** (L72, example timeline). | Use the timeline label the app actually shows, in both places. |
| 5 | `tracking/server/nodejs.mdx:359-365` | The "Common events to track" table recommends `subscription_created`, `subscription_upgraded`, `subscription_cancelled`, `payment_succeeded` and `payment_failed`, with `mrr`/`mrr_lost` properties. The same page says billing status comes from the Stripe integration (L13) and that Stripe webhooks must not be translated into SDK billing commands (L327). The table invites exactly that duplication. Separately, `invite_sent` → `inviteeEmail` puts a third party's email into event properties. | Drop the five billing rows, or keep them under a one-line label saying they are ordinary product facts that never change billing status. My preference is to drop them. Replace `inviteeEmail` with a non-PII property (for example `role`, which is already there). |
| 6 | Activation lead-ins, across SDK pages | The shared closing sentence is now identical and correct everywhere (✓ decision). The **lead-in** above it drifts in four ways, and two of them misdescribe the contract:<br>• `sveltekit.mdx:274` and `astro.mdx:410`: "Track activation after the user completes…" This implies a dedicated activation call.<br>• `vue.mdx:454`: "Track user progression through your product lifecycle". Vague lifecycle wording from before the rewrite.<br>• `nuxt.mdx:323`: "Track the configured meaningful event…"<br>• `script.mdx:295`, `npm.mdx:228`, `react.mdx:577`, `angular.mdx:373` and `rust.mdx:156`: "Track the ordinary event selected as your activation event…", followed by "Choose this event as your activation event". This is circular: "the selected event", then "choose this event".<br>In addition, the sveltekit, astro and vue examples fire `track()` on a button **click**. Every other page says to track after the milestone **succeeds**. | Use one lead-in on every SDK page, for example: "Track your value milestone as an ordinary event once it succeeds:". Keep the existing closing sentence. In the sveltekit, astro and vue samples, call `track()` in the success path (after the awaited action), or rename the handler to make that explicit. `nodejs.mdx:192` already reads well and can stay. |
| 7 | Proper-noun casing broken by the sentence-case sweep | Visible in headings, tabs and cards:<br>• "cmps": `script.mdx:124`, `react.mdx:383`<br>• "App router" / "Pages router": `nextjs.mdx:29,70`, `npm.mdx:309`, `react.mdx:599,652`. `nextjs.mdx:3` correctly says "App Router and Pages Router".<br>• "Vue router": `vue.mdx:476`<br>• "AWS lambda": `nodejs.mdx:298`<br>• "(bull, agenda)": `nodejs.mdx:329`<br>• "Nuxt auth": `nuxt.mdx:175` (use the module's own name)<br>• Stray capital in "Server-Side": `nextjs.mdx:241`, `nuxt.mdx:289`, `sveltekit.mdx:201`; card titles in `npm:451`, `react:814`, `vue:562`, `nextjs:455`, `nuxt:437`, `sveltekit:428`, `astro:516`, `angular:502` | Use "CMPs", "App Router", "Pages Router", "Vue Router", "AWS Lambda", "Bull, Agenda" and "Server-side". The npm card says only "Server-Side"; make it "Server-side tracking" to match the others. |
| 8 | Resolve vs outcome, `product/attention.mdx:54` | This line says "For renewal items, resolving can also record an outcome." Three other pages say resolving and recording an outcome are separate: `first-attention-item.mdx:40`, `actions-and-approvals.mdx:49`, and `guides/renewals.mdx:63,77` (outcome is its own step; Resolve "close[s] the item with a note"). | Align attention L54 with the other three: resolving closes the item, and the renewal outcome is recorded on the cycle. |
| 9 | `integrations/slack.mdx:35` | "…or the channel predates the connection" reads backwards. A channel that existed before setup could have been selected then; the case that actually fails is a channel **created after** setup. | Change to "…or the channel was created after you connected Slack". Keep the fix: extend channel access. |

## 2. P2: worth fixing in this pass (clarity, repetition, terminology)

**Naming consistency**
- **Responsibility names.** The sidebar and UI say **Renewals**. Prose alternates with "Renewal" / "the Renewal responsibility" in `getting-started/overview.mdx:14`, `first-attention-item.mdx:59` (card "Churn and Renewal responsibilities"), `product/responsibilities.mdx:62`, `guides/renewals.mdx:6` and `integrations/crm.mdx:6`. Pick one convention, preferably the UI label, and apply it.
- **The expansion page has three names.** Its title is "Find expansion opportunities". The card at `guides/churn.mdx:88` says "Catch expansion signals", and the card at `guides/renewals.mdx:107` says "Spot expansion". Use the sidebar/page title on every card, or the home card title if the lead prefers.
- **Supabase.** `integrations/overview.mdx:21,88` says "Supabase Auth", while `:37` and `getting-started/connect-data.mdx:21` say "Supabase". Match the catalog name.

**Repeated statements**
- **Email fallback.** It is stated three times on the churn guide (`guides/churn.mdx:18`, `:28`, `:72`) and again in `integrations/slack.mdx:20`. Keep it once in the Steps (L28) and once in troubleshooting (L72), and cut L18 down to "A Slack destination is optional but recommended; it's where cases get triaged fastest."
- **Gmail approver wording.** "Sends through the approver's connection" appears three times in `integrations/gmail.mdx` (L6, L22, L33) and again in `workspace-access.mdx:36`. Keep L22 and L33. Also, L22's "draft follow-ups for **your** customers" implies drafts are limited to customers you own; say instead "lets approved follow-ups send from your mailbox".
- **Champion example.** "Champion emails three people on your team" is used as a parallel example in both `gmail.mdx:24` and `workspace-access.mdx:43`. Keep it in Gmail and point workspace-access there.
- **Identity review availability.** Stated twice on `product/customers.mdx`, at L41 and L60. Keep one.
- **Renewals enablement.** `product/responsibilities.mdx:62` (accordion) repeats what L13 already says. The accordion can just link or refer up.
- **PostHog mapping.** `integrations/posthog.mdx:18` and `:20` both tell you to confirm the account property. Merge them into one paragraph and keep the "check a profile after first sync" check.

**Clarity**
- `getting-started/overview.mdx:20-22`: "Once you receive an invitation:" is followed by a bullet that begins "You receive an invitation…". Drop one.
- `product/workspace-access.mdx:14` vs `:20`: the table allows members "with customer-management permission", but the prose says members get "read access plus… their own work accounts". Add "unless granted customer-management permission" to L20.
- `integrations/stripe.mdx:10` vs `:19`: "two methods are available" conflicts with "the setup form shows the connection method available to your workspace". Rephrase L10 as "Outlit supports two methods; your setup form shows the one enabled for your workspace."
- `guides/churn.mdx:57`: this step is about a **case**, but says "the watch may also close quietly on its own" ("on its own" appears twice in the sentence). Say what actually closes (the case or the watch) and drop the repeat.
- `guides/renewals.mdx:32`: "reviewed by Outlit's review step" is tautological. Use "checked by Outlit before it's published as…".
- `guides/renewals.mdx:79`: "one coalesced recheck per call" is internal jargon. Use "Outlit rechecks the approach once after each new call syncs".
- `integrations/support-and-meetings.mdx:61`: the accordion titled "Calls aren't appearing" covers Pylon tickets, and "the note-taker's teammate must connect" is garbled. Retitle it "Calls or tickets aren't appearing" and write "the teammate who took the notes must connect their own key".
- `integrations/crm.mdx:8`: the filler sentence repeats L6; delete it. `:14-18`: the Salesforce and HubSpot "Notes" rows both just say "map stages", and only Attio adds information. Consider folding the table into one sentence plus the Attio note.
- `tracking/browser/nextjs.mdx:413` (middleware): dense and self-referential ("These docs recommend…"). Suggested wording: "Don't track in middleware: it can't reliably respect the visitor's consent choice or guarantee delivery, and it double-counts pageviews the browser SDK already sends. Use browser pageview tracking for page activity and `@outlit/node` in Server Actions or Route Handlers for server events, where you can `await outlit.flush()`." All caveats are kept.

**Plain language**
- `tracking/server/nodejs.mdx:327`: "authoritative SDK billing commands" → "don't send billing changes through the SDK".
- "Gracefully shutdown" → "Shut down gracefully" (verb form) at `nodejs.mdx:214`, `rust.mdx:177` and `npm.mdx:397`.
- `tracking/browser/script.mdx:10`: "ensuring zero impact on page load speed" overclaims. Use "without blocking page load".

**Callout semantics**
- `script.mdx:261`: a `<Warning>` for "identify without email/userId has no effect" describes a no-op, not a concrete risk, and uses "should" where the rule is "must". Make it a plain sentence, as `quickstart.mdx:34` and `nodejs.mdx:188` already do.

**Title-case link text**
- `script.mdx:74` "Calendar Embed Tracking" (the page title is "Calendar embed tracking")
- "Auto-Identify" at `script.mdx:70`, `npm.mdx:74` and `react.mdx:188`
- `react.mdx:751` "User Identity Patterns"
- `script.mdx:201` bold "**Automatically Removed Fields:**"
- `calendar-embeds.mdx:10` header "Detection Method"

## 3. P3: optional, only if the file is already open

- `connect-data.mdx:56`: "real readiness"
- `customers.mdx:23`: "never divorces context from urgency"
- `posthog.mdx:32`: "attributed to nothing land nowhere"
- `integrations/overview.mdx:58`: "credentials aren't reused silently"
- `gmail.mdx:10`: the Granola aside on the Gmail page
- `slack.mdx:24`: "are real signal"
- "better DX" at `nuxt.mdx:93` and `angular.mdx:70`
- `astro.mdx:65`: an unsupported "better performance" claim
- `react.mdx:328`: a hyphen used as an em dash
- `workspace-access.mdx:10`: an empty first header cell

## 4. Confirmed resolved (no action)

- **Callouts:** the Product, Guides and Integrations pages and the quickstart contain zero callouts. The SDK pages use only Info and Warning. There are no Note or Tip callouts anywhere in scope. The remaining Warnings flag concrete risks: consent persistence, leaking a server key, serverless flush, and flushing before exit.
- **Availability:** the Kanban (`attention.mdx:27`), external signals (`responsibilities.mdx:30`, `expansion.mdx:18`) and Renewals enablement sentences are truthful and brief, as decided.
- **Expansion:** framed as evidence in briefs and profiles, not as an Attention kind (`expansion.mdx:6`, `integrations/overview.mdx:6`). The guide no longer reads defensively.
- **Quickstart:** a real script-tag setup. It covers consent (L30), the rule that `identify()` needs `email` or `userId` (L34, L43), the correct activation sentence (L55), a verification step and troubleshooting links. It makes no timing promise. The anchors `#consent-management`, `#set-user-identity` and `#troubleshooting` exist.
- **Screenshots:** `renewal-item.png` appears only in renewals, with a visible "Fictional demo data." caption and a full-size link. At 390px it renders 287px wide (natural width 994), so the full-size link is needed and is present. `attention-items.png` placement was confirmed earlier in first-attention-item.
- **Removed:** the "For server-side tracking" see-also Infos (now one plain sentence each), `## Overview` on script, calendar-embeds, node and rust, "Next Steps" casing, "Core", "today", `---` rules, the Mixpanel stub (the overview covers the mapping at L45, per the decision), and the zero-information OAuth column in crm.
- **Earlier fixes:** support-and-meetings tables now have headers, and all 5 tables fit at 390px (350 of 390px). The crm tables fit. Script troubleshooting now says "the Outlit app", not "dashboard". The Stripe method table is consistent with the overview's connection-method table.

## 5. Coverage: all 55 routes

- **Home (1):** index. Reviewed in critique §9 and confirmed stable by root; not re-read.
- **Getting started (3):** getting-started/overview · connect-data · first-attention-item
- **Product (5):** product/attention · customers · actions-and-approvals · responsibilities · workspace-access
- **Guides (3):** guides/churn · expansion · renewals
- **Integrations (7):** integrations/overview · stripe · posthog · slack · gmail · crm · support-and-meetings
- **Tracking (2):** tracking/quickstart · how-it-works
- **Browser SDKs (10):** tracking/browser/script · npm · react · vue · nextjs · nuxt · sveltekit · astro · angular · calendar-embeds
- **Server SDKs (2):** tracking/server/nodejs · rust
- **Concepts (4):** concepts/customer-context-graph · customer-journey · identity-resolution · website-visitors
- **Agents (8):** ai-integrations/overview · mcp · skills · pi · platform-actions · customer-workflows · troubleshooting · use-cases/openclaw
- **CLI (5):** cli/overview · commands · integrations · ai-agents · configuration
- **API reference (5):** api-reference/introduction · validation · tools · integrations · ingest

Total: 1 + 3 + 5 + 3 + 7 + 2 + 10 + 2 + 4 + 8 + 5 + 5 = 55.

**Method:**
- **Prose:** read in full on every route. SDK code samples were scanned only for drift in the activation and identity contracts.
- **Sub-agents:** CLI, API reference and agents were read by three read-only sub-agents. I spot-checked their P1 claims against source (`tty.ts`, `tracker.ts`, the openclaw MRR block) and own every verdict below.
- **Rendered at 390px:** support-and-meetings tables, crm tables, the script page (dark), the renewals screenshot, and the mcp tables.
- **Diagrams:** both pages rendered at 1440, 390 and 320 px, light and dark (§7.4).
- **Overflow:** the lead's structural pass of all 55 routes (110 renders) covers layout overflow, so I did not repeat it.

## 6. Resolved by root and applied to this review

- **Settings label:** the canonical label is **Website Visitors**, at `/settings/workspace/website-visitors`. P1 #2 therefore means every "Website Tracking" settings path becomes "Website Visitors". That covers quickstart:6,59, script:50,420, npm:46, how-it-works:32, ai-integrations/troubleshooting:51 and api-reference/introduction:112.
- **Meeting label:** "Meeting requested" is the label. calendar-embeds:72 must use it.
- **Renewals:** `resolve_attention` is separate from `set_manual_outcome`, which confirms P1 #8. attention:54 must not say that resolving records an outcome.

## 7. Remaining 24 routes and diagram confirmation

### 7.1 P1: fix before ship

1. **identity-resolution contradicts the review rule.**
   - L98 says "Multiple matches? Merge profiles, keeping the most complete one", and L190 says "profiles are merged". Both contradict the rule that ambiguous matches wait for review (context-graph:33, stripe:36, crm:52, identity-resolution itself near L331).
   - Fix: distinguish deterministic merges on a shared exact identifier from ambiguous matches, which become merge suggestions for review.
2. **customer-journey:53 vs :166.** L53 says contacts "can never move backwards"; L166 says they "generally progress forward".
   - Keep one precise statement: "forward only, except Engaged ↔ Inactive".
3. **cli/configuration:15 is wrong.** It says `TERM=dumb` "disables ANSI colors". In `tty.ts:81`, `TERM=dumb` makes `isInteractive()` false, so output switches to JSON. configuration:138 and cli/overview:183 already say this correctly.
   - Fix: "When set to `dumb`, switches output to JSON".
4. **cli/overview:182 lists only `CI=true`.** The code also accepts `CI=1` (`tty.ts:86`).
   - Fix: "`CI=true`, `CI=1`, or `GITHUB_ACTIONS` set". Alternatively, cut this block to a link to configuration (P3 below).
5. **ai-integrations/troubleshooting:62 is wrong.** It says only server calls accept `customerId` and that browser attribution comes from email or userId. Browser `identify()` accepts `customerId` too (npm:186, `packages/browser/src/tracker.ts:293,362`).
   - Fix: "Browser and server `identify()` accept `customerId` for explicit account attribution; server `track()` does too."
6. **use-cases/openclaw:126 claims more than the query does.** It says "Track MRR movement week over week", but the query returns a current snapshot.
   - Fix: either query the `revenue` view by `snapshot_date`, or drop the claim.
7. **Sentence-case sweep damage, extending P1 #7:**
   - website-visitors:170 "visitorid" → `visitorId`, and :268 "Browser sdks" → "Browser SDKs".
   - customer-journey:176 "Server-Side tracking"; :57 and :74 "Signed up" vs the stage label **Signed Up**; table header "How It's Set" at :41 and :118.
   - identity-resolution:84 header "Identifier Type".
   - cli/ai-agents:39 "Auto-Setup"; cli/configuration:216 "Export all Customers"; cli/commands:369 "Customers Features" (anchor unchanged).
   - api-reference/tools:157 "List paying Customers"; api-reference/ingest:503 "Server-Side events".
   - skills:10 "Pi Agents".
8. **"Outlit server" is used without an article, as if it were a product name.** "Core" was replaced with "Outlit server". Use "the Outlit server" where a server is meant, otherwise "Outlit".
   - cli/integrations:20; cli/ai-agents:35,37; cli/commands:59,60,410,433,458,469
   - api-reference/integrations:9
   - customer-journey:23,45,112,138,158: plain "Outlit" is better in these concept pages.

### 7.2 P2: worth fixing in this pass

**Concepts and how-it-works**
- identity-resolution:
  - Internal model names "CustomerContact" and "Customer" (L97, L167, L198) → "contact" and "customer".
  - The personal-email rule is stated at L103 (Info) and again at L321; keep one.
  - "Send both identifiers" is at L131 and L298; keep one.
  - L6 "right complete customer profile" is awkward.
  - Stray `---` rule at L271.
- customer-journey:
  - L136-148 re-explains activation already covered above.
  - The Jane example appears twice (L140, L154).
  - L162 FAQ: "authoritative SDK command" is jargon, and the answer should come first.
  - L28 "subjects" → "contacts and companies".
  - Stray `---` rule at L95.
- website-visitors:
  - L118 repeats steps 3–4 of L113-116.
  - "We intentionally" (L132) and "we can associate" (L151) → "Outlit".
  - L136-139 bullets overlap, use hyphens as dashes, and L137 is a fragment.
  - L141 Info repeats L132.
  - L155 "available on certain plans. Contact us" → "Ask your Outlit contact". Put it at the top of that section.
- how-it-works: clean apart from the L32 settings label (§6).

**Agents**
- **Scope disclaimer repeated three times.** "Public tools don't configure agents/signals, send notifications, reveal credentials or disconnect integrations" appears at overview:56, mcp:123 and platform-actions:18. Keep it in the overview and link to it from the other two.
- **mcp tables at 390px:** tool names wrap mid-word ("outlit_merge_custome / rs", "outlit_reject_identi / ty_…"). Add `<wbr/>` after the underscores in table tool names. Copying still works, and names then break at underscores. No overflow.
- **Setup order:**
  - openclaw gives three API-key setups (L43-46, L59, L197). Lead with SecretRefs; L197 → "confirm `OUTLIT_API_KEY` is available to OpenClaw, then restart the Gateway".
  - openclaw:181-190 repeats the skills table. Link to skills instead.
  - skills:55-61: put `outlit setup --yes` (recommended) before the manual `npx` install, and delete L75-79, which repeats L14-22.
- **Plain language:**
  - pi:63 reads like a changelog. Say what each policy exposes and which one to pick.
  - platform-actions:16 "negotiate and perform bounded setup" → "start and complete supported setup steps".
  - customer-workflows:24 "churn signals Outlit already detected" → "current findings to check for risk".
  - customer-workflows:66 → "An `unavailable` state means the source didn't report; it does not mean usage is zero."
- **Callouts and labels:**
  - customer-workflows:95: the Warning states a behaviour rule, not a risk. Make it plain text; the rule is already at overview:49 and troubleshooting:22.
  - troubleshooting:66: card "Task recipes" → "Customer workflows", to match the target page title.
  - skills:53 and openclaw:190 say the outlit-sdk skill covers "billing". Verify against the skill, or say "billing-integration guidance".

**CLI**
- commands:
  - L16 and cli/overview:143 "historically preview" → "preview against past events".
  - L21 "authoritatively mutate lifecycle state" → "change lifecycle state directly".
  - L29-30 repeats the activation rule from L17-18. Delete it and keep L17-18, which has the per-person/company "independently" wording.
  - L674 "This site tracks the current public contract" talks about the docs. State the behaviour.
  - L533-535: bold the three preset UI labels.
  - Capitalisation of Feature/Features is inconsistent (cli/overview:146,149 vs commands:371-445 vs :407-408). Use lowercase in prose.
- Jargon:
  - cli/overview:157-158 "Negotiate and complete bounded provider setup" and "canonical configuration readiness" → "Connect a provider from the terminal" and "Show whether each integration is configured".
  - integrations:7,16 "public tool gateway" and `preferredSetupVersion` negotiation → one clause, or move it to the automation section.
  - integrations:23 "recovery and external-setup handoffs are terminal" → "Recovery and external setup open in the browser; the CLI does not wait for them to finish."
  - configuration:190 "code values surfaced from the tool gateway envelope" → "Commands that call Outlit return the server's `code`, `message`, `retryable` and `requestId`."
- ai-agents:33-37 repeats the setup steps from cli/integrations. Use one sentence and a link.
- Title-case link text: cli/overview:99 "MCP Integration"; configuration:190 "Error Responses".

**API reference**
- introduction:34 "exposes the same exact catalog used by the CLI and agent integrations" is only partly true: the default and analytical tool policies expose 9 and 11 tools. → "the full catalog used by the CLI and Pi package; other agent integrations may expose a subset."
- tools:32 says the tool "Must be one of the supported tool names below", but the list omits `outlit_begin_integration_setup` and `outlit_get_integration_setup_status`. Add them, or point to Integration tools.
- tools:109-123: the Configuration table repeats three purpose strings across 15 rows. Group the rows, or give each one its own verb.
- ingest:189-191: the Warning says sensitive fields "are automatically stripped on the server". This repo can only confirm client-side stripping (`packages/core/src/utils.ts` `isFieldDenied`). Unless root confirms server stripping: "The browser SDK strips common sensitive fields; don't send them in raw API calls." Keep it as a Warning.

### 7.3 P3: optional

- context-graph:39: stage casing "Signed Up" vs "Past due". Match the UI labels.
- customer-journey:46 omits Mixpanel.
- website-visitors: L8 "Visitors surface" → "page"; L107 and L128 frame visitors for sales and marketing; L184 "Keychain/Secure storage" casing. The "UTM Source/Medium" data column is Title Case.
- cli/commands:753,759,772 "`facts list` Arguments/Flags" → lowercase.
- Output modes are explained at both cli/overview:175-183 and configuration:128-138. Shorten the overview to a link; that also removes the P1 #4 risk.
- cli/integrations:16 has a curly apostrophe.
- cli/overview:48 "customer access mutations" → "changing who can access customers".
- api-reference/introduction:103-105 lists 403 before 402.
- openclaw:80 "ask it anything" and :94 overpromise; openclaw:87 `YOUR_CUSTOMER_ID` → `<customer-uuid>`.
- troubleshooting:39 → "…or `outlit setup skills`".
- pi:23 "safe for most agents" → "read-only".

### 7.4 Diagram visual confirmation (context-graph, visitor-sequence)

Rendered on the preview after the 16:23 build, at 1440, 390 and 320 px in light and dark.

**Confirmed:**
- Embedded Google Sans renders in both diagrams. The licence is in metadata, per the report.
- At 1440 px the desktop art renders at 689 px and fills the column.
- At 390 and 320 px the mobile variant renders at its native 350 px. Only one variant shows per theme and size.
- The dark variants switch correctly.
- The duplicate heading blocks are gone, and labels match between desktop and mobile.
- The visitor-sequence final arrow now connects the Outlit lifeline to "Earlier activity joins contact". The mobile five-step rail is continuous.
- Alt text is descriptive.
- At 320 px the document width stays 320, so there is no page overflow.

**One remaining finding (P2, accessibility and visual) at 320 px:**
- The 350 px asset scrolls inside a 280 px figure (`overflow-x:auto`). The right 70 px of every card is clipped, and nothing signals that the figure scrolls. See `shots3/customer-context-graph-320-light.png` and `shots3/website-visitors-320-dark.png`.
- The scrollable figure also has no `tabindex`, so keyboard users can't scroll it (axe `scrollable-region-focusable`).
- Simplest fix: below a 350 px container, scale the mobile art to 100% width instead of scrolling. That is a 0.8× scale, with body text around 10–11 px, which is legible. It removes both problems.
- Alternative: keep the scroll and add `tabindex="0"`, `role="region"` and an `aria-label` to the figure.

**Not a finding:** output nodes use connector lines without arrowheads. That reads as a fan-out tree and is consistent across both variants.

---

## 8. Focused confirmation of fixes (P1/P2, all 55 routes)

Re-checked against the current working tree (identity-resolution.mdx as of 16:32), read-only. No new research, no forks, no new stylistic findings. Method: targeted grep/read of every P1/P2 location in §1, §2, §7.1, §7.2, plus preview render of both diagram pages at 320px.

### 8.1 Resolved (verified)

**§1 P1 (first 31):**
- #1 Ergo: removed.
- #2 Settings label: no "Website Tracking" paths remain. All read **Website Visitors**, with URLs `/settings/workspace/website-visitors` (script, npm, quickstart, how-it-works, troubleshooting, api introduction).
- #3 calendar-embeds:76 is conditional on browser identification with the same email.
- #4 "Meeting requested" is used at :27 and :73.
- #5 The billing rows and `inviteeEmail` are gone from nodejs. `inviteeEmail` remains only as the ingest calendar contract field, which is correct.
- #6 The identical lead-in is on every SDK page, and the sveltekit, astro and vue samples now fire from a success callback. The vue:286 quick-reference code comment "selected as your activation event" is accepted; it isn't circular in context.
- #7 No broken proper nouns or "Server-Side" remain.
- #8 attention:54 now says resolving closes the item and that the outcome is recorded separately. This matches root's `resolve_attention` vs `set_manual_outcome`.
- #9 slack:35 is fixed.

**§2 P2 (first 31):**
- Renewals naming.
- Expansion card titles.
- Email fallback.
- Gmail approver wording and champion example.
- customers availability (once).
- responsibilities accordion.
- posthog merge.
- getting-started invitation.
- workspace-access:20 qualifier.
- churn:57.
- renewals:32/:79.
- support-and-meetings:60-61.
- crm:8 filler.
- nextjs middleware.
- nodejs "authoritative", "Gracefully shutdown", "zero impact".
- script identify Warning removed; the consent Warning at :175 remains and is a real risk.
- Title-case link text.

**§7.1 P1 (remaining 24):**
- #2 customer-journey is now consistent (forward only, except Engaged ↔ Inactive).
- #3 `TERM=dumb` now says it switches to JSON.
- #4 `CI=1` added.
- #5 troubleshooting `customerId` corrected.
- #6 openclaw now "current MRR snapshot".
- #7 all listed casing fixed.
- #8 "Outlit server" without an article is gone. The only remaining use is "an older Outlit server" at troubleshooting:15, which is correct.

**§7.2 P2 (remaining 24):**
- identity-resolution: internal model names, stray rules and awkward lead fixed.
- customer-journey: "subjects", stray rule and duplicated Jane example fixed.
- website-visitors: repetition and "we"/"Contact us" voice fixed.
- Agents disclaimer is only in the overview.
- openclaw key setup and skills table fixed.
- skills order and duplicate block fixed.
- platform-actions, customer-workflows :24/:66, the Warning at :95, and the troubleshooting card title fixed.
- skills "billing-integration guidance".
- CLI jargon fixed: "historically", "authoritatively", "canonical/bounded", "handoffs are terminal", "This site tracks".
- Activation duplicate removed.
- Presets bolded, link text fixed, ai-agents duplication removed.
- API introduction:34 subset wording fixed.
- tools table: both compatibility tools added, with a distinct purpose per row.
- The Features capitalisation is now consistent as an entity name, which is accepted.

**Root dispositions accepted:**
- ingest:189-191 describes server `formFields` filtering (root verified this in the server's ingest code). Not reverted.
- mcp tool names stay literal with native wrapping. No `<wbr/>`; the §7.2 item is withdrawn.

**Diagram at 320px (§7.4):**
- Both figures are now `role="region"`, `tabindex="0"`, with specific `aria-label`s ("Customer context graph diagram", "Visitor identity sequence diagram").
- A visible hint, "Scroll sideways or use arrow keys.", shows only below the 350px container.
- Document width stays 320.
- The accessibility finding is resolved.

### 8.2 Remaining concrete defects

| # | Sev | Where | Defect | Fix |
|---|---|---|---|---|
| R1 | P1 (pending, known) | `concepts/identity-resolution.mdx:98` | Step 4, "Ambiguous matches? Save a merge suggestion for review", still describes `identify()` as creating merge suggestions. Root says it doesn't. | Delete step 4, as root planned. :190's general statement about merge suggestions can stay; it doesn't attribute them to `identify()`. |
| R2 | P2 | `integrations/stripe.mdx:10` and `:19` | The fix to :10 made :19 a verbatim repeat ("The setup form shows the connection method available to your workspace"). | In :19, keep only "If you need another method, ask your Outlit contact." |
| R3 | P2 | `ai-integrations/pi.mdx:63` | The rewrite appended new sentences but kept the old opening. "`piToolNames` includes … the broader Pi-supported Platform surface" is then repeated by "`piToolNames` is broader: it includes Attention and relationship reads, customer access actions, and Feature tools". | Delete the first sentence. The rest reads cleanly: default (9), analytical (11), Pi (broader), choose the smallest. |
| R4 | P2 | `concepts/customer-journey.mdx:158` | The FAQ answer still opens with the jargon "No journey stage is set through an authoritative SDK command" (§7.2 item, not fixed). | Open with the direct answer and drop "authoritative", e.g. "None are set directly. Discovered and Signed Up come from identity, …" Keep the rest. |
| R5 | P3 | `concepts/customer-journey.mdx:53` | The two consecutive sentences both begin "…move forward through…". | "Contacts move forward through Discovered, Signed Up, Activated, and Engaged, and never backwards — except the Engaged ↔ Inactive cycle: …" |
| R6 | P3 | `concepts/identity-resolution.mdx:131` and `:290-292` | "Always send both `email` and `userId`" appears twice (§7.2 item, unchanged). | Optional: keep the best-practice section and drop :131, or leave it. It isn't wrong. |
| R7 | P3 (visual) | Diagram scroll hint at <350px container, both pages | The hint sits about 70px above the artwork, so it reads as a stray caption rather than a label for the figure. See `shots3/wv-320-hint.png`. | Reduce the gap between the hint and the art to about 8–12px, e.g. by removing the figure's top padding in that container query. |

No other P1/P2 finding from §1, §2, §7.1 or §7.2 remains. P3 items in §3 and §7.3 were optional and were not re-audited.

## 9. Final delta confirmation (R1–R7)

Read the current files only: identity-resolution, stripe, pi and customer-journey. I also rendered one page at 320px for R7. No broad review.

| # | Status | Evidence |
|---|---|---|
| R1 | ✅ Resolved | identity-resolution:95-99: the resolution process now has three steps, followed by "Identifying a person does not request a merge of separate customer records. Review customer merge suggestions through **Identity**." Line 191 still explains merge suggestions generally. |
| R2 | ✅ Resolved | stripe:10 has the single method statement; :19 now reads only "If you need another method, ask your Outlit contact." |
| R3 | ✅ Resolved | pi:63 is one paragraph: default (nine), `analyticalToolNames` (11, `outlit_schema`/`outlit_query`), then `piToolNames` broader. The exact tool and export names are kept. |
| R4 | ✅ Resolved | customer-journey:158 opens "None are set directly." "Authoritative" is gone. |
| R5 | ✅ Resolved | customer-journey:53: "Contacts move forward through… The exception is the Engaged ↔ Inactive cycle…" |
| R6 | ✅ Resolved | The early "send both" line is removed. The only instance is Best practices §2 (:293-295). |
| R7 | ◐ Improved, pending worker | At 320px the DOM gap between the hint and the diagram is now 0, but about 40px of top whitespace inside the mobile SVG still separates the hint from the first card (`shots3/wv-320-hint2.png`). This is P3 and doesn't block. Confirm once the diagram worker reports. |

**New defect introduced by the R1/R6 edit (P2, one line):**
- **N1:** the heading "## Auto-Identify" became "## Identify from forms", which changes its anchor. No `<span id="auto-identify" />` was kept (only `how-profiles-merge` and `merge-triggers` were). Three live links now land at the top of the page instead of the section:
  - `tracking/browser/script.mdx:70`
  - `tracking/browser/npm.mdx:74`
  - `tracking/browser/react.mdx:188`

  All three are `[Auto-identify](/concepts/identity-resolution#auto-identify)`. I confirmed in the preview that `document.getElementById("auto-identify")` is null.
- **Fix:** add `<span id="auto-identify" />` above `## Identify from forms`, to match the retained-anchor pattern. Alternatively, repoint the three links to `#identify-from-forms`.

**Disposition:**
- Once N1 is fixed, no P1 or P2 findings remain from §1, §2, §7.1, §7.2 or §8.2.
- R7 is P3 cosmetic and awaits the diagram worker.
- Earlier P3 lists (§3, §7.3) stay optional and were not re-audited.

## 10. Final clearance

- **N1 fixed.** `concepts/identity-resolution.mdx:8` now has `<span id="auto-identify" />`, and it is unique on the page (1 match). On the preview, `/concepts/identity-resolution#auto-identify` scrolls to the "Identify from forms" section at 1440px instead of the page top. The three inbound links (script:70, npm:74, react:188) now resolve.
  - **P3, optional polish:** the bare span has `scroll-margin-top: 0`, while Mintlify headings use 152px. On arrival, the "Identify from forms" heading sits under the 112px sticky header, and the first visible heading is "How it works" (`shots3/anchor-auto-identify.png`).
  - **Fix:** a `scroll-margin-top` (about 152px) on anchor-only spans. Alternatively, add a matching `<span id>` class rule in styles.css. The retained `how-profiles-merge` and `merge-triggers` spans use the same pattern, but they have no internal inbound links.
- **R7:** root accepts it as P3 spacing (the inherited 32px image margin was removed; the 8px hint padding and the SVG's internal padding are intentional). Closed, nothing pending.
- **Clearance:** no P1 or P2 findings remain from §1, §2, §7.1, §7.2, §8.2 or §9 across all 55 public routes. The remaining items are optional P3s (§3, §7.3, the anchor scroll margin above). This clearance relies on the lead's reported 41/41 tests and 110-render structural pass; I did not re-run them.
- The `du-opus-critique` browser session is closed.

## Lead follow-through after clearance

The optional legacy-anchor offset was fixed with the `docs-anchor` class. In the live preview,
`#auto-identify` has a 128px scroll margin and its heading lands at 144px, below the sticky
navigation. A rendered-target check also found and repaired the `customers-features` heading
anchor; all 42 local fragment links across 11 target pages now resolve. The final contract
suite passed all 41 tests after these content changes. CSS-only anchor spacing does not alter
those contracts. Mintlify validation, broken-link checks, the relevant Biome checks, and
`git diff --check` passed. The Tailscale preview returned HTTP 200.
