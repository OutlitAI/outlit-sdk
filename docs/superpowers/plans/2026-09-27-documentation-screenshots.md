# Product screenshot provenance

Captured on 2026-09-27 from Core `8df25b21566943aa9eb1b53d2f165902fa3c8eee`.

## Current assets

- `docs/images/product/attention-items.png`: two rendered Attention cards, one churn case and one renewal.
- `docs/images/product/renewal-item.png`: the renewal card cropped by selecting its containing element in the browser.

These are **screenshots of the actual Core React component rendered locally with fictional fixture data**, not production-workspace screenshots or a full application screen. Caption them accordingly. No customer workspace, database, authentication, email, or external action was accessed.

## Source components and styling

- `apps/platform/components/attention/attention-queue-card.tsx` (`AttentionQueueCard`, list layout), imported unchanged.
- `apps/platform/components/attention/attention-priority-badge.tsx` and `lib/attention/approach-status.ts`, imported unchanged.
- `packages/ui/src/components/avatar.tsx`, `badge.tsx`, and `utils/cn.ts`, imported unchanged.
- Core `packages/ui/src/globals.css` supplies theme and utility classes. The unrelated Clerk theme import was omitted in the isolated renderer; platform's 110% root type size and Aeonik regular/medium fonts were included.
- A temporary Bun browser bundle uses React, Next Link, Radix, and Lucide from the local marketing dependency installation. The container adds only padding and vertical spacing around the original components. Screenshots were captured through agent-browser at 1160 × 660.

## Fixture values

The fictional examples use Northstar and Acme, `northstar.example` and `acme.example`, owner Alex Morgan (`alex@example.com`), and a fixed clock of 2026-09-27 16:00 UTC. No customer logos are loaded. Northstar shows a high-priority churn case, illustrative $144,000 ARR, and one of three approach steps complete. Acme shows a normal-priority renewal, illustrative $96,000 ARR, November 4 renewal date, and zero of two steps complete. Values describe example data, not product thresholds, timing guarantees, or expected outcomes.

The captions must not imply that a step count proves an external action was executed or that a renewal completed. The main text should explain the distinction between progress and outcome.

## Refresh procedure

Render the current `AttentionQueueCard` using fictional objects matching `WebAttentionItem`; do not recreate the card in HTML or retouch its labels. Use actual Core tokens and fonts, inspect the browser for errors and correct labels, then capture the component element. Re-review the guide against the current product before replacing an image. If a safe demo workspace becomes available, full-screen captures can supplement these component screenshots.
